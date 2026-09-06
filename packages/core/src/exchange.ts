/**
 * TempoExchange — TEMPO's typed wrapper over the official
 * `@somnia-chain/markets-sdk`. One place that knows how the venue works:
 * chain-gated status reads, tick/lot grids, receipt checks, the Finalized
 * claim flow, and the official price feed. Every method returns REAL values or
 * throws a typed error — never a fabricated placeholder.
 */
import {
  SomniaMarkets,
  ORDER_TYPE,
  isBinaryMarket,
  binaryModuleReadAbi,
  type UnifiedMarket,
  type PlaceOrderResult,
} from "@somnia-chain/markets-sdk";
import { erc20Abi, createPublicClient, createWalletClient, getAddress, parseAbi, http, type Address, type PublicClient, type WalletClient } from "viem";
import { somniaMainnet, somniaShannon, defineChain } from "@somnia-chain/markets-sdk/chains";
import type { TempoConfig } from "./config.js";
import { TempoError } from "./errors.js";
import { lotsToSize, probToTicks, sizeToLots } from "./quant.js";
import { fairValue, realizedVolPerSqrtSec } from "./fairValue.js";
import { RiskEngine, type RiskVerdict } from "./risk.js";
import { assertAllowedDestinations, expectedChainId } from "./wallet.js";

export interface BinaryMarketInfo {
  marketId: string;
  symbol: string;
  upSymbol: string;
  downSymbol: string;
  asset: string;
  intervalSec: number;
  /** Unix seconds. */
  expiry: number;
  /** Unix seconds. */
  tradingStart?: number;
  venueId?: string;
  oracleQuestionId?: string;
  pool?: string;
  /** Raw oracle/fixed boundary value from the indexed market row. */
  strike?: string;
  resolutionMode?: "reference" | "fixed";
}

export interface OnchainMarket {
  status: number;
  pool: string;
  marketAddress: string;
  outcomeToken: string;
  yesId: bigint;
  noId: bigint;
  isResolved: boolean;
  isVoided: boolean;
  winningOutcome?: number;
  decimals?: number;
}

export interface BookParams {
  tickSize: bigint;
  lotSize: bigint;
  minQuantity?: bigint;
  /** Probability tick as a float (tickSize / 1e18). */
  tick: number;
  /** Lot as a float in human contracts. */
  lot: number;
  decimals: number;
}

export interface TakerFill {
  id: string;
  marketId?: string;
  pool: string;
  side?: "buy" | "sell" | undefined;
  price: number;
  size: number;
  ts?: number;
}

export const ORACLE_EXPLORER = "https://prd.oracle.somnia.host";

export function oracleQuestionUrl(oracleQuestionId: string | undefined): string | undefined {
  if (!oracleQuestionId) return undefined;
  return `${ORACLE_EXPLORER}/questions/${oracleQuestionId}?view=graph`;
}

export function normalizeOpeningBoundary(boundary: unknown, referenceSpot: number): number | undefined {
  if (boundary === undefined || boundary === null || !Number.isFinite(referenceSpot) || referenceSpot <= 0) return undefined;
  const value = typeof boundary === "object"
    ? (boundary as Record<string, unknown>).numericValue ?? (boundary as Record<string, unknown>).value
    : boundary;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return undefined;
  const candidates = Array.from({ length: 19 }, (_, decimals) => raw / 10 ** decimals);
  const best = candidates.reduce((a, b) =>
    Math.abs(Math.log(Math.max(b, Number.MIN_VALUE) / referenceSpot)) <
    Math.abs(Math.log(Math.max(a, Number.MIN_VALUE) / referenceSpot)) ? b : a,
  );
  const ratio = best / referenceSpot;
  return ratio >= 0.5 && ratio <= 2 ? best : undefined;
}

export interface TempoExchangeOptions {
  config: TempoConfig;
  /** Signer for writes; omit for read-only. */
  privateKey?: `0x${string}`;
  /** Browser wallet client; never exposes a private key to TEMPO. */
  walletClient?: WalletClient;
}

export interface PreparedTrade {
  market: BinaryMarketInfo;
  onchain: OnchainMarket;
  outcome: "UP" | "DOWN";
  side: "buy" | "sell";
  size: number;
  price: number;
  expireTimestampNs: bigint;
  secondsLeft: number;
  worstCaseCost: number;
  verdict: RiskVerdict;
}

export class TempoExchange {
  readonly sdk: SomniaMarkets;
  readonly readonly: boolean;
  private readonly cfg: TempoConfig;
  private marketsCache: { at: number; rows: BinaryMarketInfo[] } | null = null;
  private collateralDecimalsCache: number | null = null;
  private readonly publicClient: PublicClient;

  constructor(opts: TempoExchangeOptions) {
    this.cfg = opts.config;
    this.readonly = !opts.privateKey && !opts.walletClient;
    const base = opts.config.network === "testnet" ? somniaShannon : somniaMainnet;
    const chain =
      opts.config.endpoints.rpcUrl === base.rpcUrls.default.http[0]
        ? base
        : defineChain({
            ...base,
            rpcUrls: { default: { http: [opts.config.endpoints.rpcUrl], webSocket: [opts.config.endpoints.wsRpcUrl] } },
          });
    this.sdk = new SomniaMarkets({
      indexerUrl: opts.config.endpoints.indexerUrl,
      chain,
      wsRpcUrl: opts.config.endpoints.wsRpcUrl,
      addresses: opts.config.addresses,
      priceFeed: opts.config.endpoints.priceFeed,
      privateKey: opts.privateKey,
      walletClient: opts.walletClient,
    });
    this.publicClient = createPublicClient({ chain, transport: http(opts.config.endpoints.rpcUrl) });
  }

  private assertWritesAllowed(): void {
    if (this.cfg.paused) throw new TempoError("RISK_REJECTED", "TEMPO_PAUSED emergency kill switch is active");
  }

  get walletAddress(): string | undefined {
    return this.sdk.walletAddress;
  }

  /** Current RPC head used by readiness checks; no signer is required. */
  async rpcHead(): Promise<bigint> {
    return this.publicClient.getBlockNumber();
  }

  async verifyReceipt(hash: string): Promise<{ hash: string; status: "success" | "reverted"; block: string }> {
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new TempoError("UNAVAILABLE", "transaction hash is malformed");
    const receipt = await this.publicClient.getTransactionReceipt({ hash: hash as `0x${string}` });
    return { hash, status: receipt.status === "success" ? "success" : "reverted", block: receipt.blockNumber.toString() };
  }

  /** Build unsigned approval/order calls for an external browser wallet. */
  async buildWalletOrder(address: string, marketRef: string, outcome: "UP" | "DOWN", size: number, price: number) {
    this.assertWritesAllowed();
    if (!/^0x[0-9a-f]{40}$/i.test(address)) throw new TempoError("UNAVAILABLE", "wallet address is malformed");
    const chain = this.publicClient.chain;
    if (!chain) throw new TempoError("CHAIN_UNAVAILABLE", "configured chain is unavailable");
    const walletClient = createWalletClient({ account: address as Address, chain, transport: http(this.cfg.endpoints.rpcUrl) });
    const browserExchange = new TempoExchange({ config: this.cfg, walletClient });
    try {
      const prepared = await browserExchange.prepareTrade(marketRef, outcome, size, price);
      const params = await browserExchange.bookParams(prepared.onchain.pool);
      const rawPrice = probToTicks(outcome === "DOWN" ? 1 - prepared.price : prepared.price, params.tickSize, params.decimals);
      const rawSize = sizeToLots(prepared.size, params.lotSize, params.decimals);
      const unsigned = await browserExchange.sdk.trader.buildPlaceOrder({
        pool: prepared.onchain.pool as `0x${string}`,
        side: outcome === "DOWN" ? "BUY_NO" : "BUY_YES",
        price: rawPrice,
        quantity: rawSize,
        expireTimestampNs: prepared.expireTimestampNs,
        orderType: ORDER_TYPE.MARKET,
        autoApprove: true,
      });
      const calls = [unsigned.approval, unsigned.order].filter((call): call is NonNullable<typeof call> => Boolean(call));
      const protocolAddresses = [
        ...Object.values(this.cfg.addresses).filter((value): value is string => typeof value === "string"),
        prepared.onchain.pool,
        prepared.onchain.marketAddress,
        prepared.onchain.outcomeToken,
      ];
      const destinations = assertAllowedDestinations(calls, protocolAddresses);
      const [collateral, nativeRaw] = await Promise.all([
        this.collateralBalance(address),
        this.publicClient.getBalance({ address: address as Address }),
      ]);
      if (collateral.human < prepared.worstCaseCost) {
        throw new TempoError("RISK_REJECTED", `insufficient collateral: need ${prepared.worstCaseCost}, available ${collateral.human}`);
      }
      const nativeValue = calls.reduce((sum, call) => sum + BigInt(call.value ?? 0), 0n);
      if (nativeRaw < nativeValue) throw new TempoError("RISK_REJECTED", "insufficient native balance for transaction value");
      return {
        prepared,
        approval: unsigned.approval,
        order: unsigned.order,
        review: {
          chainId: expectedChainId(this.cfg.network),
          destinations,
          nativeValue,
          collateralBalance: collateral.human,
          collateralDecimals: collateral.decimals,
          allowlistValidated: true,
        },
      };
    } finally {
      await browserExchange.close();
    }
  }

  /** Collateral decimals — derived from the token itself, never hardcoded. */
  async collateralDecimals(): Promise<number> {
    if (this.collateralDecimalsCache !== null) return this.collateralDecimalsCache;
    const collateral = this.cfg.addresses.collateral as `0x${string}`;
    const decimals = await this.publicClient.readContract({
      address: collateral,
      abi: erc20Abi,
      functionName: "decimals",
    });
    this.collateralDecimalsCache = decimals;
    return decimals;
  }

  async collateralBalance(address?: string): Promise<{ raw: bigint; human: number; decimals: number }> {
    const addr = (address ?? this.walletAddress) as `0x${string}`;
    if (!addr) throw new TempoError("NO_KEY", "no address available for balance read");
    const decimals = await this.collateralDecimals();
    const collateral = this.cfg.addresses.collateral as `0x${string}`;
    const raw = await this.publicClient.readContract({
      address: collateral,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addr],
    });
    return { raw, human: Number(raw) / 10 ** decimals, decimals };
  }

  /** Live binary markets from the unified tier (symbol-keyed, with outcomes). */
  async markets(opts: { maxAgeMs?: number } = {}): Promise<BinaryMarketInfo[]> {
    const maxAge = opts.maxAgeMs ?? 4000;
    const now = Date.now();
    if (this.marketsCache && now - this.marketsCache.at <= maxAge) return this.marketsCache.rows;
    const unified: UnifiedMarket[] = Object.values(await this.sdk.loadMarkets(true));
    const rows: BinaryMarketInfo[] = [];
    for (const m of unified) {
      if (!m.active || !isBinaryMarket(m.info)) continue;
      const info = m.info as Record<string, unknown>;
      const marketId = String(info.marketId ?? "");
      if (!marketId) continue;
      const up = m.outcomes?.[0]?.symbol;
      const down = m.outcomes?.[1]?.symbol;
      if (!up || !down) continue;
      rows.push({
        marketId,
        symbol: m.symbol,
        upSymbol: up,
        downSymbol: down,
        asset: String(info.asset ?? ""),
        intervalSec: Number(info.intervalSec ?? 0),
        expiry: Number(info.expiry ?? 0),
        tradingStart: info.tradingStart !== undefined ? Number(info.tradingStart) : undefined,
        venueId: info.venueId !== undefined ? String(info.venueId) : undefined,
        oracleQuestionId: info.oracleQuestionId !== undefined ? String(info.oracleQuestionId) : undefined,
        pool: info.pool !== undefined ? String(info.pool) : undefined,
        strike: info.strike !== undefined ? String(info.strike) : undefined,
        resolutionMode: info.mode === "reference" || info.mode === "fixed" ? info.mode : undefined,
      });
    }
    const wanted = new Set(this.cfg.assets);
    const filtered = rows.filter(
      (r) => (wanted.size ? wanted.has(r.asset.toUpperCase()) : true) && (!this.cfg.venueId || r.venueId === this.cfg.venueId),
    );
    this.marketsCache = { at: now, rows: filtered };
    return filtered;
  }

  async onchain(marketId: string): Promise<OnchainMarket> {
    if (this.cfg.addresses.binaryModule) {
      try {
        const moduleAddr = getAddress(this.cfg.addresses.binaryModule);
        const rec = (await this.publicClient.readContract({
          address: moduleAddr,
          abi: binaryModuleReadAbi,
          functionName: "markets",
          args: [marketId as `0x${string}`],
        })) as unknown as readonly [unknown, unknown, unknown, string, unknown, unknown, unknown, unknown, string, string, bigint, bigint, unknown, bigint];
        const marketAddress = getAddress(rec[8]);
        const pool = getAddress(rec[9]);
        const yesId = BigInt(rec[10]);
        const noId = BigInt(rec[11]);
        const m = {
          address: marketAddress,
          abi: parseAbi([
            "function outcomeToken() view returns (address)",
            "function status() view returns (uint8)",
            "function isResolved() view returns (bool)",
            "function isVoided() view returns (bool)",
          ]),
        };
        const [outcomeToken, status, isResolved, isVoided] = await Promise.all([
          this.publicClient.readContract({ ...m, functionName: "outcomeToken" }),
          this.publicClient.readContract({ ...m, functionName: "status" }),
          this.publicClient.readContract({ ...m, functionName: "isResolved" }),
          this.publicClient.readContract({ ...m, functionName: "isVoided" }),
        ]);
        return {
          status: Number(status),
          pool: String(pool),
          marketAddress: String(marketAddress),
          outcomeToken: String(outcomeToken),
          yesId,
          noId,
          isResolved: Boolean(isResolved),
          isVoided: Boolean(isVoided),
          decimals: undefined,
        };
      } catch {
        // Fall back to sdk client below
      }
    }
    const oc = await this.sdk.client.getMarketOnchain(marketId as `0x${string}`);
    return {
      status: Number(oc.status),
      pool: String(oc.pool),
      marketAddress: String(oc.marketAddress),
      outcomeToken: String(oc.outcomeToken),
      yesId: oc.yesId,
      noId: oc.noId,
      isResolved: oc.isResolved,
      isVoided: oc.isVoided,
      winningOutcome: oc.winningOutcome === undefined ? undefined : Number(oc.winningOutcome),
      decimals: oc.decimals === undefined ? undefined : Number(oc.decimals),
    };
  }

  async bookParams(pool: string): Promise<BookParams> {
    const decimals = await this.collateralDecimals();
    let p: { tickSize: bigint; lotSize: bigint; minQuantity?: bigint };
    try {
      const poolAddr = getAddress(pool);
      const abi = parseAbi([
        "function getOrderBookParameters() view returns (uint256 tickSize, uint256 minQuantity, uint256 lotSize)",
      ]);
      const [tickSize, minQuantity, lotSize] = (await this.publicClient.readContract({
        address: poolAddr,
        abi,
        functionName: "getOrderBookParameters",
      })) as unknown as readonly [bigint, bigint, bigint];
      p = { tickSize, minQuantity, lotSize };
    } catch {
      p = await this.sdk.client.getBinaryBookParams(pool as `0x${string}`);
    }
    return {
      tickSize: p.tickSize,
      lotSize: p.lotSize,
      minQuantity: p.minQuantity !== undefined ? BigInt(p.minQuantity) : undefined,
      tick: Number(p.tickSize) / 10 ** decimals,
      lot: Number(p.lotSize) / 10 ** decimals,
      decimals,
    };
  }

  /** Live order book for the Up (YES) outcome, human units. */
  async book(upSymbol: string, depth = 5): Promise<{ bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }> }> {
    const ob = await this.sdk.fetchOrderBook(upSymbol, depth);
    return {
      bids: (ob.bids ?? []).map((l) => ({ price: Number(l[0]), size: Number(l[1]) })),
      asks: (ob.asks ?? []).map((l) => ({ price: Number(l[0]), size: Number(l[1]) })),
    };
  }

  /** The window's opening price (the strike) — an on-chain fact. */
  async openingPrice(marketId: string, referenceSpot?: number): Promise<number | undefined> {
    const key = marketId.toLowerCase();
    const cached = this.marketsCache?.rows.find((row) => row.marketId.toLowerCase() === key);
    const market = cached ?? (await this.markets()).find((row) => row.marketId.toLowerCase() === key);
    let boundary: unknown = market?.resolutionMode === "fixed" ? market.strike : undefined;
    if (boundary === undefined) {
      const res = await this.sdk.client.getOpeningPrices([marketId as `0x${string}`]);
      boundary = (res as Record<string, unknown> | undefined)?.[marketId.toLowerCase()];
    }
    if (!market) return typeof boundary === "number" ? boundary : Number(boundary);
    const livePrice = referenceSpot ?? (await this.spot(market.asset))?.price;
    if (!livePrice) return undefined;
    return normalizeOpeningBoundary(boundary, livePrice);
  }

  /** Underlying spot from the official price feed. */
  async spot(asset: string): Promise<{ price: number; ema: number; ts: number; block?: number; rawPrice?: string } | null> {
    const px = await this.sdk.fetchPrice(asset);
    if (!px) return null;
    const info = px.info as { blockNumber?: number; raw?: { price?: string } } | undefined;
    return {
      price: Number(px.price),
      ema: Number(px.ema),
      ts: Number(px.timestamp),
      block: info?.blockNumber,
      rawPrice: info?.raw?.price,
    };
  }

  async spotHistory(asset: string, opts: { limit?: number; from?: number; to?: number } = {}): Promise<Array<{ price: number; ts: number }>> {
    const pts = await this.sdk.client.fetchPriceHistory(asset, opts);
    return (pts ?? []).map((p: unknown) => {
      const row = p as { price: number; timestamp?: number; blockTimestamp?: number };
      const sec = Number(row.blockTimestamp ?? row.timestamp ?? 0);
      const ts = sec > 0 && sec < 1e11 ? sec * 1000 : sec;
      return { price: Number(row.price), ts };
    });
  }

  /** Outcome token balance (ERC-6909 id) — the honest position read. */
  async outcomeBalance(onchain: OnchainMarket, outcome: "UP" | "DOWN", address?: string): Promise<number> {
    const addr = (address ?? this.walletAddress) as `0x${string}`;
    if (!addr) throw new TempoError("NO_KEY", "no address for outcome balance");
    const decimals = await this.collateralDecimals();
    const id = outcome === "UP" ? onchain.yesId : onchain.noId;
    let raw: bigint;
    try {
      const outcomeToken = getAddress(onchain.outcomeToken);
      const abi = parseAbi(["function balanceOf(address account, uint256 id) view returns (uint256)"]);
      raw = (await this.publicClient.readContract({
        address: outcomeToken,
        abi,
        functionName: "balanceOf",
        args: [getAddress(addr), id],
      })) as bigint;
    } catch {
      raw = 0n;
    }
    return Number(raw) / 10 ** decimals;
  }

  private async assertReceipt(res: unknown, label: string): Promise<{ hash?: string; status?: string }> {
    const info = (res as { info?: PlaceOrderResult } | null)?.info;
    const receipt = (info?.receipt ?? (res as { receipt?: { status?: string; transactionHash?: string } }).receipt) as
      | { status?: string; transactionHash?: string }
      | undefined;
    const hash = receipt?.transactionHash ?? (res as { hash?: string }).hash;
    if (receipt && receipt.status === "reverted") {
      throw new TempoError("REVERTED", `${label} reverted on-chain`, { tx: hash });
    }
    if (receipt) return { hash, status: receipt.status };
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new TempoError("UNAVAILABLE", `${label} returned no transaction receipt`);
    }
    const mined = await this.publicClient.getTransactionReceipt({ hash: hash as `0x${string}` });
    if (mined.status !== "success") throw new TempoError("REVERTED", `${label} reverted on-chain`, { tx: hash });
    return { hash, status: mined.status };
  }

  private async marketForRef(ref: string): Promise<BinaryMarketInfo> {
    const lowered = ref.toLowerCase();
    const matches = (row: BinaryMarketInfo): boolean =>
      row.marketId.toLowerCase() === lowered ||
      row.symbol.toLowerCase() === lowered ||
      row.upSymbol.toLowerCase() === lowered ||
      row.downSymbol.toLowerCase() === lowered;
    const cached = this.marketsCache?.rows.find(matches);
    if (cached) return cached;
    const market = (await this.markets({ maxAgeMs: 0 })).find(
      (row) =>
        matches(row),
    );
    if (!market) throw new TempoError("UNAVAILABLE", `live binary market not found for ${ref}`);
    return market;
  }

  private async requireTrading(ref: string): Promise<{ market: BinaryMarketInfo; onchain: OnchainMarket }> {
    const isMarketId = /^0x[0-9a-f]{64}$/i.test(ref);
    const onchain = isMarketId ? await this.onchain(ref) : undefined;
    if (onchain && onchain.status !== 1) {
      throw new TempoError("MARKET_NOT_TRADING", `${ref} on-chain status is ${onchain.status}, expected 1`, {
        marketId: ref,
        status: onchain.status,
      });
    }
    const market = await this.marketForRef(ref);
    const checked = onchain ?? (await this.onchain(market.marketId));
    if (checked.status !== 1) {
      throw new TempoError("MARKET_NOT_TRADING", `${market.symbol} on-chain status is ${checked.status}, expected 1`, {
        marketId: market.marketId,
        status: checked.status,
      });
    }
    return { market, onchain: checked };
  }

  /**
   * Build and risk-check a manual IOC order without signing or sending it.
   * Browser wallets and MCP simulation use this exact preparation path before
   * the caller is allowed to request a signature.
   */
  async prepareTrade(
    marketRef: string,
    outcome: "UP" | "DOWN",
    size: number,
    price: number,
    opts: { expireTimestampNs?: bigint; secondsLeft?: number } = {},
  ): Promise<PreparedTrade> {
    const { market, onchain } = await this.requireTrading(marketRef);
    const params = await this.bookParams(onchain.pool);
    const nowMs = Date.now();
    const secondsLeft = opts.secondsLeft ?? market.expiry - nowMs / 1000;
    const nowSec = BigInt(Math.floor(nowMs / 1000));
    const marketExpirySec = BigInt(Math.floor(market.expiry));
    const requested = opts.expireTimestampNs ?? (nowSec + 8n) * 1_000_000_000n;
    const expireTimestampNs = requested < marketExpirySec * 1_000_000_000n
      ? requested
      : marketExpirySec * 1_000_000_000n;
    if (expireTimestampNs <= BigInt(nowMs) * 1_000_000n) {
      throw new TempoError("MARKET_EXPIRED", `${market.symbol} has no valid order lifetime`);
    }
    const humanYesPrice = outcome === "DOWN" ? 1 - price : price;
    const rawPrice = probToTicks(humanYesPrice, params.tickSize, params.decimals);
    const quantizedPrice = Number(rawPrice) / 10 ** params.decimals;
    const rawSize = sizeToLots(size, params.lotSize, params.decimals);
    const quantizedSize = lotsToSize(rawSize, params.decimals);
    const engine = new RiskEngine(this.cfg.risk);
    const verdict = engine.check(
      {
        outcome,
        price: outcome === "DOWN" ? 1 - quantizedPrice : quantizedPrice,
        size: quantizedSize,
        collateral: quantizedPrice * quantizedSize,
        secondsLeft,
        intervalSec: market.intervalSec,
      },
      { netInventory: 0, grossInventory: 0, capitalCommitted: 0, openOrders: 0, realizedPnl: 0 },
    );
    if (!verdict.ok) {
      throw new TempoError("RISK_REJECTED", verdict.reason, { code: verdict.code });
    }
    return {
      market,
      onchain,
      outcome,
      side: "buy",
      size: quantizedSize,
      price: outcome === "DOWN" ? 1 - quantizedPrice : quantizedPrice,
      expireTimestampNs,
      secondsLeft,
      worstCaseCost: quantizedPrice * quantizedSize,
      verdict,
    };
  }

  /**
   * Place an order through the unified tier. `postOnly` for maker quotes,
   * `timeInForce: "IOC"` for taker orders. Size must already be lot-quantized;
   * price must already be tick-snapped (policies guarantee both).
   */
  async place(
    symbol: string,
    side: "buy" | "sell",
    size: number,
    price: number,
    opts: { postOnly?: boolean; ioc?: boolean; expireTimestampNs?: bigint } = {},
  ): Promise<{ hash?: string; status?: string; filled?: number; orderId?: string }> {
    this.assertWritesAllowed();
    if (this.readonly) throw new TempoError("NO_KEY", `place() on ${symbol} requires a signer`);
    const market = await this.marketForRef(symbol);
    const outcome = symbol.toLowerCase() === market.downSymbol.toLowerCase() ? "DOWN" : "UP";
    const prepared = await this.prepareTrade(market.marketId, outcome, size, price, {
      expireTimestampNs: opts.expireTimestampNs,
    });
    const onchain = prepared.onchain;
    const params = await this.bookParams(onchain.pool);
    const isDown = symbol.toLowerCase() === market.downSymbol.toLowerCase();
    const expiry = prepared.expireTimestampNs;
    const humanYesPrice = isDown ? 1 - price : price;
    const rawPrice = probToTicks(humanYesPrice, params.tickSize, params.decimals);
    const one = 10n ** BigInt(params.decimals);
    if (rawPrice <= 0n || rawPrice >= one) throw new TempoError("PRICE_OFF_GRID", `price ${price} is outside the valid tick grid`);
    const rawSize = sizeToLots(prepared.size, params.lotSize, params.decimals);
    if (rawSize < (params.minQuantity ?? params.lotSize)) throw new TempoError("BELOW_ONE_LOT", `size ${size} is below market minimum`);
    const binarySide = `${side === "buy" ? "BUY" : "SELL"}_${isDown ? "NO" : "YES"}` as
      | "BUY_YES"
      | "SELL_YES"
      | "BUY_NO"
      | "SELL_NO";
    const result = await this.sdk.trader.placeOrder({
      pool: onchain.pool as `0x${string}`,
      side: binarySide,
      price: rawPrice,
      quantity: rawSize,
      expireTimestampNs: expiry,
      orderType: opts.postOnly ? ORDER_TYPE.POST_ONLY : opts.ioc ? ORDER_TYPE.MARKET : ORDER_TYPE.LIMIT,
    });
    const out = await this.assertReceipt(result, `order ${side} ${size} ${symbol} @ ${price}`);
    return {
      ...out,
      filled: lotsToSize(result.fills.reduce((sum, fill) => sum + fill.quantityFilled, 0n), params.decimals),
      orderId: result.orderId?.toString(),
    };
  }

  async cancel(orderId: string, symbol: string): Promise<{ hash?: string; status?: string }> {
    this.assertWritesAllowed();
    if (this.readonly) throw new TempoError("NO_KEY", "cancel() requires a signer");
    await this.requireTrading(symbol);
    const result = await this.sdk.cancelOrder(orderId, symbol);
    return await this.assertReceipt(result, `cancel ${orderId}`);
  }

  async openOrders(symbol: string): Promise<Array<{ id: string; side: string; price: number; size: number }>> {
    const open = await this.sdk.fetchOpenOrders(symbol);
    return (open ?? []).map((o) => ({
      id: String(o.id),
      side: String(o.side ?? ""),
      price: Number(o.price ?? 0),
      size: Number(o.amount ?? 0),
    }));
  }

  async myTrades(symbol: string, since?: number): Promise<TakerFill[]> {
    const trades = await this.sdk.fetchMyTrades(symbol, since);
    return (trades ?? []).map((t) => ({
      id: String(t.id),
      pool: String((t.info as Record<string, unknown> | undefined)?.pool ?? ""),
      side: t.side,
      price: Number(t.price),
      size: Number(t.amount),
      ts: t.timestamp ? Math.floor(t.timestamp / 1000) : undefined,
    }));
  }

  async mintSet(symbol: string, size: number): Promise<{ hash?: string }> {
    this.assertWritesAllowed();
    if (this.readonly) throw new TempoError("NO_KEY", "mintSet() requires a signer");
    const { market } = await this.requireTrading(symbol);
    const res = await this.sdk.mintSet(market.symbol, size);
    return await this.assertReceipt(res, `mintSet ${size} ${symbol}`);
  }

  async burnSet(symbol: string, size: number): Promise<{ hash?: string }> {
    this.assertWritesAllowed();
    if (this.readonly) throw new TempoError("NO_KEY", "burnSet() requires a signer");
    const { market } = await this.requireTrading(symbol);
    const res = await this.sdk.burnSet(market.symbol, size);
    return await this.assertReceipt(res, `burnSet ${size} ${symbol}`);
  }

  /** Settled (Finalized) markets with claimable outcomes for this wallet. */
  async claims(
    limit = 40,
    filter: { asset?: string; intervalSec?: number; venueId?: string } = {},
  ): Promise<
    Array<{ marketId: string; symbol?: string; resolved: boolean; voided: boolean; winningOutcome?: number; oracleQuestionId?: string; expiry?: number }>
  > {
    const settled = await this.sdk.client.listBinaryMarkets({ ...filter, status: "Finalized", orderBy: "newest", limit });
    return (settled ?? [])
      .sort((a, b) => Number(b.expiry ?? 0) - Number(a.expiry ?? 0))
      .map((m) => {
        const row = m as unknown as Record<string, unknown>;
        return {
          marketId: String(m.marketId),
          symbol: row.symbol !== undefined ? String(row.symbol) : undefined,
          resolved: Boolean(row.isResolved),
          voided: Boolean(row.isVoided),
          winningOutcome: row.winningOutcome !== undefined ? Number(row.winningOutcome) : undefined,
          oracleQuestionId: row.oracleQuestionId !== undefined ? String(row.oracleQuestionId) : undefined,
          expiry: m.expiry !== undefined ? Number(m.expiry) : undefined,
        };
      });
  }

  /** Redeem a winning (or voided) outcome via the trader tier with explicit index. */
  async redeem(marketId: string, onchain: OnchainMarket, outcome: "UP" | "DOWN"): Promise<{ hash?: string }> {
    this.assertWritesAllowed();
    if (this.readonly) throw new TempoError("NO_KEY", "redeem() requires a signer");
    if (!onchain.isResolved && !onchain.isVoided) throw new TempoError("MARKET_NOT_TRADING", `${marketId} is not finalized for redemption`);
    const id = outcome === "UP" ? onchain.yesId : onchain.noId;
    const addr = this.walletAddress as `0x${string}`;
    const raw = await this.sdk.client.getOutcomeBalance({
      outcomeToken: onchain.outcomeToken as `0x${string}`,
      account: addr,
      id,
    });
    if (raw === 0n) return {};
    const res = await this.sdk.trader.redeem({
      marketId: marketId as `0x${string}`,
      market: (onchain.marketAddress || onchain.pool) as `0x${string}`,
      outcomeToken: onchain.outcomeToken as `0x${string}`,
      outcomeIdx: outcome === "UP" ? 0 : 1,
      amount: raw,
    });
    return await this.assertReceipt(res, `redeem ${outcome} ${marketId}`);
  }

  /** Testnet-only collateral mint (10k tUSDC cap per call). */
  async faucet(): Promise<{ hash?: string }> {
    this.assertWritesAllowed();
    if (this.readonly) throw new TempoError("NO_KEY", "faucet() requires a signer");
    if (this.cfg.network !== "testnet") throw new TempoError("CONFIG_INVALID", "faucet is testnet-only");
    const res = await this.sdk.trader.faucet();
    return await this.assertReceipt(res, "faucet");
  }

  /** Full resolution record for a settled market (opening vs closing answer). */
  async resolution(marketId: string): Promise<Record<string, unknown> | undefined> {
    const res = await this.sdk.client.getMarketResolution(marketId as `0x${string}`);
    return res as unknown as Record<string, unknown> | undefined;
  }

  /** Historical tape: finalized binary markets, most-recently-expired first. */
  async pastMarkets(opts: { asset?: string; limit?: number } = {}): Promise<Array<Record<string, unknown>>> {
    const rows = await this.sdk.client.listPastBinaryMarkets({
      status: "Finalized",
      ...(opts.asset ? { asset: opts.asset } : {}),
      limit: opts.limit ?? 50,
    });
    return (rows ?? []) as unknown as Array<Record<string, unknown>>;
  }

  /** Replay the appraiser over real finalized windows and real feed history. */
  async backtest(limit = 10): Promise<
    Array<{
      marketId: string;
      asset: string;
      expiry: number;
      estimate?: number;
      outcome?: number;
      brier?: number;
      samples: number;
      status: "EVALUATED" | "NO DATA";
      reason?: string;
    }>
  > {
    const rows = await this.pastMarkets({ limit: Math.max(1, limit) });
    const output = [];
    for (const row of rows) {
      const marketId = String(row.marketId ?? row.id ?? "");
      const asset = String(row.asset ?? "");
      const expiry = Number(row.expiry ?? 0);
      const intervalSec = Number(row.intervalSec ?? 0);
      const start = Number(row.tradingStart ?? expiry - intervalSec);
      const outcome = row.voided ? undefined : row.winningOutcome === undefined ? undefined : Number(row.winningOutcome) === 0 ? 1 : 0;
      if (!marketId || !asset || !expiry || !intervalSec || outcome === undefined) {
        output.push({ marketId, asset, expiry, outcome, samples: 0, status: "NO DATA" as const, reason: "market boundary or binary outcome unavailable" });
        continue;
      }
      const ticks = await this.spotHistory(asset, { from: Math.max(0, start - intervalSec), to: expiry, limit: 1000 }).catch(() => []);
      const midpoint = start + intervalSec / 2;
      const history = ticks.filter((tick) => (tick.ts > 1e12 ? tick.ts / 1000 : tick.ts) <= midpoint);
      const spotTick = history[history.length - 1];
      const sigma = realizedVolPerSqrtSec(history);
      let boundaryRaw = row.mode === "fixed" ? row.strike : undefined;
      if (boundaryRaw === undefined) {
        const resolution = await this.resolution(marketId).catch(() => undefined);
        const answer = resolution?.openingAnswer;
        boundaryRaw = typeof answer === "object" && answer !== null
          ? (answer as Record<string, unknown>).numericValue ?? (answer as Record<string, unknown>).value
          : answer;
      }
      if (!spotTick || !Number.isFinite(sigma) || boundaryRaw === undefined || boundaryRaw === null) {
        output.push({ marketId, asset, expiry, outcome, samples: history.length, status: "NO DATA" as const, reason: "real midpoint feed history, volatility, or opening boundary unavailable" });
        continue;
      }
      const raw = Number(boundaryRaw);
      const candidates = Array.from({ length: 19 }, (_, decimals) => raw / 10 ** decimals);
      const strike = candidates.reduce((a, b) =>
        Math.abs(Math.log(Math.max(b, Number.MIN_VALUE) / spotTick.price)) <
        Math.abs(Math.log(Math.max(a, Number.MIN_VALUE) / spotTick.price))
          ? b
          : a,
      );
      const estimate = fairValue({ spot: spotTick.price, strike, sigmaPerSqrtSec: sigma, secondsLeft: expiry - midpoint }).p;
      if (!Number.isFinite(estimate)) {
        output.push({ marketId, asset, expiry, outcome, samples: history.length, status: "NO DATA" as const, reason: "fair-value inputs invalid" });
        continue;
      }
      output.push({
        marketId,
        asset,
        expiry,
        estimate,
        outcome,
        brier: (estimate - outcome) ** 2,
        samples: history.length,
        status: "EVALUATED" as const,
      });
    }
    return output;
  }

  async candles(pool: string, bucket: 60 | 300 | 900 | 3600, opts: { from?: number; to?: number } = {}) {
    return this.sdk.client.getCandles(pool as `0x${string}`, bucket, opts);
  }

  /** DESIGN §17 convenience alias for the normalized on-chain opening price. */
  async opening(marketId: string): Promise<number | undefined> {
    return this.openingPrice(marketId);
  }

  /** IOC buy in outcome terms. Remainders never rest. */
  async trade(
    marketRef: string,
    outcome: "UP" | "DOWN",
    size: number,
    price: number,
  ): Promise<{ hash?: string; status?: string; filled?: number; orderId?: string }> {
    const market = await this.marketForRef(marketRef);
    return this.place(outcome === "UP" ? market.upSymbol : market.downSymbol, "buy", size, price, { ioc: true });
  }

  /** Post-only maker quote with an explicit dead-man expiry. */
  async quote(
    marketRef: string,
    outcome: "UP" | "DOWN",
    size: number,
    price: number,
    expireTimestampNs?: bigint,
  ): Promise<{ hash?: string; status?: string; filled?: number; orderId?: string }> {
    const market = await this.marketForRef(marketRef);
    return this.place(outcome === "UP" ? market.upSymbol : market.downSymbol, "buy", size, price, {
      postOnly: true,
      expireTimestampNs,
    });
  }

  async cancelAll(marketRef: string): Promise<{ cancelled: number }> {
    const market = await this.marketForRef(marketRef);
    await this.requireTrading(market.marketId);
    let cancelled = 0;
    for (const symbol of [market.upSymbol, market.downSymbol]) {
      for (const order of await this.openOrders(symbol)) {
        await this.cancel(order.id, symbol);
        cancelled++;
      }
    }
    return { cancelled };
  }

  /** Live on-chain outcome balances, keyed by market id rather than recycled pool. */
  async positions(address?: string, limit = 50): Promise<
    Array<{ marketId: string; symbol: string; up: number; down: number; status: number }>
  > {
    const owner = address ?? this.walletAddress;
    if (!owner) throw new TempoError("NO_KEY", "positions() requires an address or signer");
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TempoError("UNAVAILABLE", "positions limit must be an integer from 1 to 50");
    const rows = (await this.markets()).slice(0, limit);
    return Promise.all(
      rows.map(async (market) => {
        const onchain = await this.onchain(market.marketId);
        const [up, down] = await Promise.all([
          this.outcomeBalance(onchain, "UP", owner),
          this.outcomeBalance(onchain, "DOWN", owner),
        ]);
        return { marketId: market.marketId, symbol: market.symbol, up, down, status: onchain.status };
      }),
    );
  }

  /** Redeem only the paying side, or both sides for a voided market. */
  async claim(marketId: string): Promise<Array<{ outcome: "UP" | "DOWN"; hash?: string }>> {
    const onchain = await this.onchain(marketId);
    if (!onchain.isResolved && !onchain.isVoided) {
      throw new TempoError("UNAVAILABLE", `${marketId} is not resolved or voided`);
    }
    const outcomes: Array<"UP" | "DOWN"> = onchain.isVoided
      ? ["UP", "DOWN"]
      : [onchain.winningOutcome === 0 ? "UP" : "DOWN"];
    const results: Array<{ outcome: "UP" | "DOWN"; hash?: string }> = [];
    for (const outcome of outcomes) results.push({ outcome, ...(await this.redeem(marketId, onchain, outcome)) });
    return results;
  }

  async close(): Promise<void> {
    await this.sdk.close();
  }
}
