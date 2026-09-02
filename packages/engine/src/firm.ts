/**
 * The Firm — TEMPO's autonomous runtime.
 *
 * Two agents on separate keys with separate policies share one reactive event
 * loop over the venue's live tail:
 *
 *   GENESIS (maker)  — anchors every newborn window with a two-sided,
 *     zero-inventory quote (mint-a-pair) computed from the oracle feed vs the
 *     on-chain opening price, requotes reactively, manages the endgame.
 *   VECTOR (taker)   — takes IOC liquidity when the touch diverges from its
 *     own fair value beyond its edge; stands down otherwise.
 *
 * A shared RiskEngine gates every plan. A claim sweep redeems settled markets.
 * Every event, decision, and write is journaled. Without keys the firm runs
 * read-only (policies evaluate, nothing sends).
 */
import {
  AgentLedger,
  Journal,
  RiskEngine,
  TempoExchange,
  type BinaryMarketInfo,
  type BookParams,
  type TempoConfig,
  type MarketLifecycle,
  oracleQuestionUrl,
} from "@tempo/core";
import { Appraiser } from "./appraiser.js";
import { Executor, type ExecutionResult } from "./executor.js";
import { genesisQuotePlan, takerPlan, type Book, type MakerInputs, type TakerInputs } from "@tempo/core";

const DECISION_INTERVAL_MS = 1500;
const DISCOVERY_INTERVAL_MS = 4000;
const CLAIM_SWEEP_MS = 90_000;
const ONCHAIN_TTL_MS = 2000;
const BOOKPARAMS_TTL_MS = 60_000;
const OPENING_TTL_FOUND_MS = 60_000;
const OPENING_TTL_MISSING_MS = 2000;
const LIVE_TAIL_START_TIMEOUT_MS = 15_000;

/** Only windows of these cadences are actively managed (display shows all). */
const MANAGED_CADENCES = new Set([60, 300, 900, 3600]);

interface ManagedMarket extends BinaryMarketInfo {
  managed: boolean;
  watchedAt: number;
  lastDecisionAt: number;
  lastStatus: number;
  birthAnnounced: boolean;
  lifecycle: MarketLifecycle;
}

interface CacheEntry<T> {
  value: T;
  at: number;
}

export interface AgentState {
  name: "GENESIS" | "VECTOR";
  address?: string;
  readOnly: boolean;
  dryRun: boolean;
  collateral: { human: number; decimals: number } | null;
  realizedPnl: number;
  fillCount: number;
  openOrders: number;
  lastActionAt?: string;
  lastDecision?: string;
  inventory: Record<string, { qtyUp: number; qtyDown: number }> | null;
}

interface MarketView {
  status: number;
  spot: { value: number; ema?: number; at: string; block?: number; source: "price-feed" };
  opening: { value: number; at: string; source: "on-chain/indexer" };
  fairValue: { value: number; band: [number, number]; sigma: number; samples: number; at: string; source: "AI ESTIMATE" };
  book: Book;
  bookAt: string;
}

interface SettlementView {
  marketId: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  winningOutcome?: number;
  voided: boolean;
  tradeCount?: string;
  lastPrice?: number;
  oracleUrl?: string;
  source: "indexer/on-chain";
}

export class Firm {
  readonly journal: Journal;
  readonly appraiser: Appraiser;
  readonly risk: RiskEngine;
  private readonly cfg: TempoConfig;
  private maker: TempoExchange;
  private taker: TempoExchange;
  private ledgers: Record<"GENESIS" | "VECTOR", AgentLedger> = {
    GENESIS: new AgentLedger(),
    VECTOR: new AgentLedger(),
  };
  private seenFillIds = new Set<string>();
  private markets = new Map<string, ManagedMarket>();
  private onchainCache = new Map<string, CacheEntry<Awaited<ReturnType<TempoExchange["onchain"]>>>>();
  private bookParamsCache = new Map<string, CacheEntry<BookParams>>();
  private openingCache = new Map<string, CacheEntry<number | undefined>>();
  private executors: Record<"GENESIS" | "VECTOR", Executor>;
  private timers: NodeJS.Timeout[] = [];
  private running = false;
  private cycleQueued = false;
  private cycleRunning = false;
  private discoveryRunning = false;
  private claimSweepRunning = false;
  private unsubLive?: () => void;
  private discoveryHandle?: NodeJS.Timeout;
  private priceWatchLoops: Promise<void>[] = [];
  private startedAt = Date.now();
  private lastClaimSweep = 0;
  private agentState: Record<"GENESIS" | "VECTOR", AgentState>;
  private priceWatches = new Set<string>();
  private marketViews = new Map<string, MarketView>();
  private settlements: SettlementView[] = [];
  private spots = new Map<string, { price: number; ema: number; ts: number; block?: number }>();
  private readonly managedCadences: Set<number>;

  constructor(cfg: TempoConfig, opts: { managedCadences?: readonly number[] } = {}) {
    this.cfg = cfg;
    this.managedCadences = new Set(opts.managedCadences ?? MANAGED_CADENCES);
    this.journal = new Journal(cfg.journalDir, "tempo");
    this.risk = new RiskEngine(cfg.risk);
    this.appraiser = new Appraiser(async (asset) => {
      const probe = new TempoExchange({ config: cfg });
      try {
        return await probe.spotHistory(asset, { limit: 240 });
      } finally {
        await probe.close();
      }
    });
    this.maker = new TempoExchange({ config: cfg, privateKey: cfg.keys.maker });
    this.taker = new TempoExchange({ config: cfg, privateKey: cfg.keys.taker });
    const dryRun = cfg.dryRun;
    this.executors = {
      GENESIS: new Executor(this.maker, this.journal, "GENESIS", dryRun),
      VECTOR: new Executor(this.taker, this.journal, "VECTOR", dryRun),
    };
    this.agentState = {
      GENESIS: {
        name: "GENESIS",
        address: this.maker.walletAddress,
        readOnly: !cfg.keys.maker,
        dryRun,
        collateral: null,
        realizedPnl: 0,
        fillCount: 0,
        openOrders: 0,
        inventory: null,
      },
      VECTOR: {
        name: "VECTOR",
        address: this.taker.walletAddress,
        readOnly: !cfg.keys.taker,
        dryRun,
        collateral: null,
        realizedPnl: 0,
        fillCount: 0,
        openOrders: 0,
        inventory: null,
      },
    };
  }

  // -- lifecycle ------------------------------------------------------------

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.journal.open();
    this.journal.append({
      type: "startup",
      data: {
        network: this.cfg.network,
        dryRun: this.cfg.dryRun,
        maker: this.agentState.GENESIS.readOnly ? "READ-ONLY" : this.agentState.GENESIS.address,
        taker: this.agentState.VECTOR.readOnly ? "READ-ONLY" : this.agentState.VECTOR.address,
        managedCadences: [...this.managedCadences],
        assets: this.cfg.assets,
      },
    });
    await this.refreshMarkets(true);

    // Whole-protocol tail with birth discovery — Somnia's live watches
    // materialize books locally and pick up new markets the block they deploy.
    let liveTailTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.maker.sdk.client.watchMarkets({ discover: true }),
        new Promise<never>((_, reject) => {
          liveTailTimer = setTimeout(
            () => reject(new Error(`watchMarkets startup exceeded ${LIVE_TAIL_START_TIMEOUT_MS} ms`)),
            LIVE_TAIL_START_TIMEOUT_MS,
          );
        }),
      ]);
      clearTimeout(liveTailTimer);
      this.unsubLive = this.maker.sdk.client.subscribeLive(() => {
        if (this.cycleQueued) return;
        this.cycleQueued = true;
        setTimeout(() => {
          this.cycleQueued = false;
          void this.cycle("event");
        }, 350);
      });
    } catch (e) {
      clearTimeout(liveTailTimer);
      this.maker.sdk.client.stopLive();
      this.journal.append({
        type: "error",
        data: { what: "live tail unavailable — falling back to interval cycles", message: String(e) },
      });
    }

    // Per-asset price watch loops (official feed). watchPrice resolves on the
    // next tick — the loop re-arms itself; each tick feeds the appraiser.
    for (const asset of this.cfg.assets) {
      const loop = this.priceLoop(asset).catch((e) => {
        this.journal.append({ type: "error", data: { what: `price watch ${asset}`, message: String(e) } });
      });
      this.priceWatchLoops.push(loop);
    }

    // Heartbeat cycles (event-driven + 2s heartbeat covers quiet books).
    this.timers.push(
      setInterval(() => void this.cycle("heartbeat"), 2000),
      setInterval(() => void this.refreshMarkets(false), DISCOVERY_INTERVAL_MS),
      setInterval(() => void this.sweepClaims(), CLAIM_SWEEP_MS),
      setInterval(() => void this.refreshAgentState(), 10_000),
    );
    this.discoveryHandle = this.timers[1];
    void this.sweepClaims();
    void this.refreshAgentState();
    void this.refreshSettlements();
    this.timers.push(setInterval(() => void this.refreshSettlements(), 30_000));
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    if (this.discoveryHandle) clearInterval(this.discoveryHandle);
    this.unsubLive?.();
    this.maker.sdk.client.stopLive();
    this.journal.append({ type: "shutdown", data: { uptimeMs: Date.now() - this.startedAt } });
    await this.journal.close();
    await Promise.allSettled([this.maker.close(), this.taker.close()]);
  }

  private async priceLoop(asset: string): Promise<void> {
    await this.appraiser.seed(asset);
    while (this.running) {
      try {
        const px = await this.maker.sdk.watchPrice(asset);
        this.appraiser.observe(asset, Number(px.price), Number(px.timestamp));
        const info = px.info as { blockNumber?: number } | undefined;
        this.spots.set(asset, { price: Number(px.price), ema: Number(px.ema), ts: Number(px.timestamp), block: info?.blockNumber });
        this.priceWatches.add(asset);
        this.journal.append({
          type: "price",
          source: "price-feed",
          data: { asset, price: Number(px.price), ema: Number(px.ema), ts: Number(px.timestamp) },
        });
      } catch (e) {
        if (!this.running) return;
        this.journal.append({ type: "error", data: { what: `price loop ${asset}`, message: String(e) } });
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  // -- discovery ------------------------------------------------------------

  private async refreshMarkets(first: boolean): Promise<void> {
    if (this.discoveryRunning) return;
    this.discoveryRunning = true;
    let rows: BinaryMarketInfo[];
    try {
      rows = await this.maker.markets();
    } catch (e) {
      this.journal.append({ type: "error", data: { what: "market discovery", message: String(e) } });
      return;
    } finally {
      this.discoveryRunning = false;
    }
    const now = Date.now();
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(row.marketId);
      const managed = this.managedCadences.has(row.intervalSec) && row.expiry * 1000 > now;
      let m = this.markets.get(row.marketId);
      if (!m) {
        m = { ...row, managed, watchedAt: 0, lastDecisionAt: 0, lastStatus: -1, birthAnnounced: false, lifecycle: "BIRTH" };
        this.markets.set(row.marketId, m);
      } else {
        Object.assign(m, { ...row, managed });
      }
      if (first && managed) {
        m.birthAnnounced = true; // don't announce pre-existing windows as births
      }
      if (managed && !m.birthAnnounced) {
        m.birthAnnounced = true;
        this.journal.append({
          type: "market-birth",
          source: "live-tail/discovery",
          marketId: m.marketId,
          symbol: m.symbol,
          data: {
            asset: m.asset,
            intervalSec: m.intervalSec,
            expiry: m.expiry,
            venueId: m.venueId,
          },
        });
      }
      // Watch scope: manage the book for cadences we trade; cheap ref-counted.
      if (m.managed && m.pool && now - m.watchedAt > BOOKPARAMS_TTL_MS) {
        m.watchedAt = now;
        void this.maker.sdk.client.watchMarket(m.pool).catch(() => {
          m!.watchedAt = 0;
        });
      }
    }
    // Drop windows that are gone and no longer worth showing.
    for (const [id, m] of this.markets) {
      if (!seen.has(id) && m.expiry * 1000 < now - 3600_000) this.markets.delete(id);
    }
  }

  private transition(m: ManagedMarket, lifecycle: MarketLifecycle, data: Record<string, unknown> = {}): void {
    if (m.lifecycle === lifecycle) return;
    const previous = m.lifecycle;
    m.lifecycle = lifecycle;
    this.journal.append({
      type: "market-state",
      source: "firm-state-machine",
      marketId: m.marketId,
      symbol: m.symbol,
      data: { previous, lifecycle, ...data },
    });
  }

  // -- caches ----------------------------------------------------------------

  private async onchain(marketId: string, fresh = false) {
    const hit = this.onchainCache.get(marketId);
    if (!fresh && hit && Date.now() - hit.at < ONCHAIN_TTL_MS) return hit.value;
    const value = await this.maker.onchain(marketId);
    this.onchainCache.set(marketId, { value, at: Date.now() });
    return value;
  }

  private async bookParams(pool: string): Promise<BookParams> {
    const hit = this.bookParamsCache.get(pool);
    if (hit && Date.now() - hit.at < BOOKPARAMS_TTL_MS) return hit.value;
    const value = await this.maker.bookParams(pool);
    this.bookParamsCache.set(pool, { value, at: Date.now() });
    return value;
  }

  private async openingPrice(marketId: string, referenceSpot?: number): Promise<number | undefined> {
    const hit = this.openingCache.get(marketId);
    const ttl = hit?.value !== undefined ? OPENING_TTL_FOUND_MS : OPENING_TTL_MISSING_MS;
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    let value: number | undefined;
    try {
      value = await this.maker.openingPrice(marketId, referenceSpot);
    } catch {
      value = undefined;
    }
    this.openingCache.set(marketId, { value, at: Date.now() });
    return value;
  }

  // -- the cycle -------------------------------------------------------------

  private async cycle(trigger: "event" | "heartbeat"): Promise<void> {
    if (!this.running || this.cycleRunning || this.claimSweepRunning) return;
    this.cycleRunning = true;
    try {
      const nowSec = Date.now() / 1000;
      for (const m of this.markets.values()) {
        if (!m.managed) continue;
        const secondsLeft = m.expiry - nowSec;
        if (nowSec * 1000 - m.lastDecisionAt < DECISION_INTERVAL_MS) continue;
        m.lastDecisionAt = nowSec * 1000;
        if (secondsLeft <= 0) {
          await this.advanceClosedMarket(m);
          continue;
        }
        await this.decide(m, secondsLeft, trigger);
      }
    } finally {
      this.cycleRunning = false;
    }
  }

  private async advanceClosedMarket(m: ManagedMarket): Promise<void> {
    if (m.lifecycle !== "LOCK" && m.lifecycle !== "SETTLE" && m.lifecycle !== "CLAIM" && m.lifecycle !== "ROLL") {
      this.transition(m, "LOCK", { reason: "expiry boundary crossed", expiry: m.expiry });
    }
    try {
      const oc = await this.onchain(m.marketId, true);
      if (oc.status !== m.lastStatus) {
        this.journal.append({
          type: "market-state",
          source: "on-chain",
          marketId: m.marketId,
          symbol: m.symbol,
          data: { status: oc.status, secondsLeft: Math.round(m.expiry - Date.now() / 1000) },
        });
        m.lastStatus = oc.status;
      }
      if (oc.isResolved || oc.isVoided || oc.status === 4 || oc.status === 5) {
        this.transition(m, "SETTLE", { status: oc.status });
      } else {
        this.transition(m, "LOCK", { status: oc.status });
      }
    } catch (error) {
      this.journal.append({
        type: "error",
        marketId: m.marketId,
        data: { what: "closed-market chain state", message: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  private async decide(m: ManagedMarket, secondsLeft: number, trigger: "event" | "heartbeat"): Promise<void> {
    try {
      // Chain truth gates every decision (indexer lags seconds — gotcha #1).
      const oc = await this.onchain(m.marketId);
      if (oc.status !== m.lastStatus) {
        this.journal.append({
          type: "market-state",
          source: "on-chain",
          marketId: m.marketId,
          symbol: m.symbol,
          data: { status: oc.status, secondsLeft: Math.round(secondsLeft) },
        });
        m.lastStatus = oc.status;
      }
      if (oc.status !== 1) {
        this.transition(m, oc.status === 2 ? "LOCK" : oc.isResolved || oc.isVoided || oc.status === 4 || oc.status === 5 ? "SETTLE" : "LOCK", {
          status: oc.status,
        });
        return;
      }
      if (m.lifecycle === "BIRTH") this.transition(m, "ANCHOR", { status: oc.status });
      const endgameAt = Math.max(20, Math.floor(m.intervalSec * 0.1));
      if (secondsLeft <= endgameAt) this.transition(m, "ENDGAME", { secondsLeft: Math.round(secondsLeft) });

      const spot = this.spots.get(m.asset) ?? this.appraiser.latest(m.asset);
      if (!spot) {
        this.journal.append({ type: "error", data: { what: `price feed unavailable for ${m.asset}`, code: "FEED_UNAVAILABLE" } });
        return;
      }
      const [opening, params] = await Promise.all([
        this.openingPrice(m.marketId, spot.price),
        this.bookParams(oc.pool),
      ]);
      if (opening === undefined) return; // honest: no strike yet → no anchor
      const { fv, sigma, samples } = this.appraiser.appraise(m.asset, spot.price, opening, secondsLeft);

      let book: Book = { yesBids: [], yesAsks: [], noBids: [], noAsks: [] };
      try {
        const live = this.maker.sdk.client.getLiveBinaryOrderBookByMarket(m.marketId, { depth: 8 });
        const scale = 10 ** params.decimals;
        book = {
          yesBids: live.yesBids.map((level) => ({ price: Number(level.price) / scale, size: Number(level.quantity) / scale })),
          yesAsks: live.yesAsks.map((level) => ({ price: Number(level.price) / scale, size: Number(level.quantity) / scale })),
          noBids: live.noBids.map((level) => ({ price: Number(level.price) / scale, size: Number(level.quantity) / scale })),
          noAsks: live.noAsks.map((level) => ({ price: Number(level.price) / scale, size: Number(level.quantity) / scale })),
        };
      } catch {
        // Empty arrays are an honest not-yet-hydrated live store.
      }
      this.marketViews.set(m.marketId, {
        status: oc.status,
        spot: {
          value: spot.price,
          ...(this.spots.get(m.asset)?.ema !== undefined ? { ema: this.spots.get(m.asset)!.ema } : {}),
          ...(this.spots.get(m.asset)?.block !== undefined ? { block: this.spots.get(m.asset)!.block } : {}),
          at: new Date(spot.ts).toISOString(),
          source: "price-feed",
        },
        opening: { value: opening, at: new Date().toISOString(), source: "on-chain/indexer" },
        fairValue: { value: fv.p, band: fv.band, sigma, samples, at: new Date().toISOString(), source: "AI ESTIMATE" },
        book,
        bookAt: new Date().toISOString(),
      });

      if (secondsLeft <= endgameAt) this.transition(m, "ENDGAME", { secondsLeft: Math.round(secondsLeft) });
      else if (m.lifecycle === "ANCHOR" || m.lifecycle === "BIRTH") this.transition(m, "GENESIS");
      else this.transition(m, "REPRICE");

      this.journal.append({
        type: "decision",
        source: `appraiser(${trigger})`,
        marketId: m.marketId,
        symbol: m.symbol,
        data: {
          spot: spot.price,
          strike: opening,
          sigma,
          samples,
          secondsLeft: Math.round(secondsLeft),
          fairP: Number.isFinite(fv.p) ? Number(fv.p.toFixed(4)) : null,
          band: Number.isFinite(fv.p) ? [Number(fv.band[0].toFixed(4)), Number(fv.band[1].toFixed(4))] : null,
        },
      });
      if (!Number.isFinite(fv.p)) {
        this.journal.append({
          type: "decision",
          source: "appraiser",
          marketId: m.marketId,
          symbol: m.symbol,
          data: { outcome: "NO DATA", reason: "insufficient real price-feed history", samples },
        });
        return;
      }

      // GENESIS (maker)
      if (!this.agentState.GENESIS.readOnly) {
        await this.runMaker(m, oc, params, fv, secondsLeft, spot.price, opening);
      } else {
        this.journal.append({
          type: "decision",
          agent: "GENESIS",
          marketId: m.marketId,
          symbol: m.symbol,
          data: { outcome: "UNAVAILABLE", reason: "TEMPO_KEY_MAKER not configured", dryRun: this.cfg.dryRun },
        });
      }
      // VECTOR (taker)
      if (!this.agentState.VECTOR.readOnly) {
        await this.runTaker(m, oc, params, fv, secondsLeft);
      } else {
        this.journal.append({
          type: "decision",
          agent: "VECTOR",
          marketId: m.marketId,
          symbol: m.symbol,
          data: { outcome: "UNAVAILABLE", reason: "TEMPO_KEY_TAKER not configured", dryRun: this.cfg.dryRun },
        });
      }
    } catch (e) {
      this.journal.append({
        type: "error",
        marketId: m.marketId,
        data: { what: "decide", message: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  private async myOpenOrders(
    exchange: TempoExchange,
    m: ManagedMarket,
    decimals: number,
  ): Promise<Array<{ id: string; side: "BUY_UP" | "BUY_DOWN" | "SELL_UP" | "SELL_DOWN"; price: number; size: number; symbol: string }>> {
    const out: Array<{ id: string; side: "BUY_UP" | "BUY_DOWN" | "SELL_UP" | "SELL_DOWN"; price: number; size: number; symbol: string }> = [];
    try {
      const addr = exchange.walletAddress;
      if (!addr) return out;
      const orders = exchange.sdk.client.getLiveUserOrders(m.pool ?? "", addr, { limit: 60 });
      for (const o of orders) {
        if (o.market_id?.toLowerCase() !== m.marketId.toLowerCase()) continue;
        if (o.status !== "Open" || !o.rested) continue;
        const price = Number(o.price) / 10 ** decimals;
        const size = Number(o.quantityRemaining) / 10 ** decimals;
        let side: "BUY_UP" | "BUY_DOWN" | "SELL_UP" | "SELL_DOWN";
        if (o.side === "BUY_YES") side = "BUY_UP";
        else if (o.side === "SELL_YES") side = "SELL_UP";
        else if (o.side === "BUY_NO") side = "BUY_DOWN";
        else if (o.side === "SELL_NO") side = "SELL_DOWN";
        else continue;
        out.push({
          id: o.orderId,
          side,
          price,
          size,
          symbol: side === "BUY_UP" || side === "SELL_UP" ? m.upSymbol : m.downSymbol,
        });
      }
    } catch {
      // live store not hydrated for this agent — fall through with empty set
    }
    return out;
  }

  private async runMaker(
    m: ManagedMarket,
    oc: Awaited<ReturnType<TempoExchange["onchain"]>>,
    params: BookParams,
    fv: { p: number; d: number; band: [number, number]; expectedMove: number },
    secondsLeft: number,
    spot: number,
    strike: number,
  ): Promise<void> {
    const ex = this.maker;
    const addr = ex.walletAddress;
    if (!addr) return;
    const [openOrders, balances] = await Promise.all([
      this.myOpenOrders(ex, m, params.decimals),
      Promise.all([ex.outcomeBalance(oc, "UP"), ex.outcomeBalance(oc, "DOWN")]).catch(() => null),
    ]);
    if (!balances) {
      this.journal.append({ type: "decision", agent: "GENESIS", marketId: m.marketId, data: { outcome: "UNAVAILABLE", reason: "on-chain inventory read failed" } });
      return;
    }
    const [upBal, downBal] = balances;
    const netInventory = upBal - downBal;
    const inputs: MakerInputs = {
      meta: {
        marketId: m.marketId,
        symbol: m.symbol,
        asset: m.asset,
        intervalSec: m.intervalSec,
        expiry: m.expiry,
        venueId: m.venueId,
      },
      book: { yesBids: [], yesAsks: [], noBids: [], noAsks: [] }, // policy uses fair value, not the touch
      fv,
      netInventory,
      openOrders,
      now: Date.now() / 1000,
      tick: params.tick,
      lot: params.lot,
      halfSpread: this.cfg.risk.halfSpread0,
      quoteSize: this.cfg.risk.quoteSize,
      minLeftSec: this.risk.minLeftMaker(m.intervalSec),
    };
    const plan = genesisQuotePlan(inputs);
    if (!plan) return;

    // Risk gate per order with real inventory/capital state (escrow of resting
    // orders + inventory gross from on-chain balances).
    let sent = 0;
    const escrowed = openOrders.reduce((acc, wo) => acc + wo.price * wo.size, 0);
    for (const o of plan.orders) {
      const collateral = o.price * o.size;
      const verdict = this.risk.check(
        {
          outcome: o.kind === "BUY_UP" || o.kind === "SELL_UP" ? "UP" : "DOWN",
          price: o.price,
          size: o.size,
          collateral: o.kind === "SELL_UP" ? 0 : collateral,
          secondsLeft,
          intervalSec: m.intervalSec,
        },
        {
          netInventory,
          grossInventory: upBal + downBal,
          capitalCommitted: escrowed,
        },
      );
      if (!verdict.ok) {
        this.journal.append({
          type: "risk-reject",
          agent: "GENESIS",
          marketId: m.marketId,
          symbol: m.symbol,
          data: { order: o.kind, reason: verdict.reason, code: verdict.code },
        });
        continue;
      }
      sent++;
      const one: typeof plan = { ...plan, orders: [o], cancels: sent === 1 ? plan.cancels : [] };
      const res = await this.executors.GENESIS.executeQuotePlan(m, one, params);
      this.recordExecution("GENESIS", res);
      if (res.errors.length > 0 && res.sent === 0) break; // don't hammer a failing path
    }
    if (plan.orders.length === 0 && plan.cancels.length > 0) {
      const res = await this.executors.GENESIS.executeQuotePlan(m, plan, params);
      this.recordExecution("GENESIS", res);
    }
    this.agentState.GENESIS.lastDecision = `quote ${m.symbol} bid ${plan.anchorBid.toFixed(3)}/ask ${plan.anchorAsk.toFixed(3)}`;
    this.agentState.GENESIS.lastActionAt = new Date().toISOString();
  }

  private async runTaker(
    m: ManagedMarket,
    oc: Awaited<ReturnType<TempoExchange["onchain"]>>,
    params: BookParams,
    fv: { p: number; d: number; band: [number, number]; expectedMove: number },
    secondsLeft: number,
  ): Promise<void> {
    const ex = this.taker;
    const addr = ex.walletAddress;
    if (!addr) return;
    // The taker reads the LIVE book (the locally materialized one from chain logs).
    let book: Book;
    try {
      const live = ex.sdk.client.getLiveBinaryOrderBookByMarket(m.marketId, { depth: 5 });
      const scale = 10 ** params.decimals;
      book = {
        yesBids: live.yesBids.map((l) => ({ price: Number(l.price) / scale, size: Number(l.quantity) / scale })),
        yesAsks: live.yesAsks.map((l) => ({ price: Number(l.price) / scale, size: Number(l.quantity) / scale })),
        noBids: live.noBids.map((l) => ({ price: Number(l.price) / scale, size: Number(l.quantity) / scale })),
        noAsks: live.noAsks.map((l) => ({ price: Number(l.price) / scale, size: Number(l.quantity) / scale })),
      };
    } catch {
      return;
    }
    const balances = await Promise.all([ex.outcomeBalance(oc, "UP"), ex.outcomeBalance(oc, "DOWN")]).catch(() => null);
    if (!balances) {
      this.journal.append({ type: "decision", agent: "VECTOR", marketId: m.marketId, data: { outcome: "UNAVAILABLE", reason: "on-chain inventory read failed" } });
      return;
    }
    const [upBal, downBal] = balances;
    const inputs: TakerInputs = {
      meta: {
        marketId: m.marketId,
        symbol: m.symbol,
        asset: m.asset,
        intervalSec: m.intervalSec,
        expiry: m.expiry,
        venueId: m.venueId,
      },
      book,
      fv,
      now: Date.now() / 1000,
      tick: params.tick,
      lot: params.lot,
      edge: this.cfg.risk.takerEdge,
      size: this.cfg.risk.quoteSize,
      minLeftSec: this.risk.minLeftTaker(),
      maxCollateral: this.cfg.risk.maxOrderCollateral,
    };
    const plan = takerPlan(inputs);
    if (!plan) return;
    const collateral = plan.price * plan.size;
    const verdict = this.risk.checkTaker(
      {
        outcome: plan.kind === "BUY_UP" ? "UP" : "DOWN",
        price: plan.price,
        size: plan.size,
        collateral,
        secondsLeft,
        intervalSec: m.intervalSec,
        fairValue: fv.p,
        edge: this.cfg.risk.takerEdge,
      },
      { netInventory: upBal - downBal, grossInventory: upBal + downBal, capitalCommitted: 0 },
    );
    if (!verdict.ok) {
      this.journal.append({
        type: "risk-reject",
        agent: "VECTOR",
        marketId: m.marketId,
        symbol: m.symbol,
        data: { order: plan.kind, reason: verdict.reason, code: verdict.code },
      });
      return;
    }
    const res = await this.executors.VECTOR.executeTakerPlan(m, plan, params);
    this.recordExecution("VECTOR", res);
    this.agentState.VECTOR.lastDecision = `take ${plan.kind} ${plan.size} @ ${plan.price.toFixed(3)} (${plan.reason})`;
    this.agentState.VECTOR.lastActionAt = new Date().toISOString();
  }

  private recordExecution(agent: "GENESIS" | "VECTOR", res: ExecutionResult): void {
    const st = this.agentState[agent];
    st.openOrders = Math.max(0, st.openOrders + res.sent - res.cancelled);
  }

  // -- fills (real, from the live tail) ---------------------------------------

  private async ingestFills(): Promise<void> {
    const pairs: Array<["GENESIS" | "VECTOR", TempoExchange]> = [
      ["GENESIS", this.maker],
      ["VECTOR", this.taker],
    ];
    for (const [name, ex] of pairs) {
      const addr = ex.walletAddress;
      if (!addr) continue;
      let fills;
      try {
        fills = ex.sdk.client.getLiveUserFills(null, addr, { limit: 40 });
      } catch {
        continue;
      }
      for (const f of fills) {
        const key = `${name}:${f.id}`;
        if (this.seenFillIds.has(key)) continue;
        this.seenFillIds.add(key);
        if (this.seenFillIds.size > 5000) this.seenFillIds = new Set([...this.seenFillIds].slice(-2000));
        const weAreTaker = f.taker?.toLowerCase() === addr.toLowerCase();
        const ourSide = weAreTaker ? f.takerSide : f.makerSide;
        // BinarySide is the order kind itself: BUY_YES / SELL_YES / BUY_NO / SELL_NO.
        const kind: "BUY_UP" | "SELL_UP" | "BUY_DOWN" | "SELL_DOWN" | null =
          ourSide === "BUY_YES"
            ? "BUY_UP"
            : ourSide === "SELL_YES"
              ? "SELL_UP"
              : ourSide === "BUY_NO"
                ? "BUY_DOWN"
                : ourSide === "SELL_NO"
                  ? "SELL_DOWN"
                  : null;
        if (!kind) continue;
        const market = this.markets.get(f.market_id);
        if (!market) continue;
        let decimals: number;
        try {
          const oc = await this.onchain(f.market_id);
          decimals = (await this.bookParams(oc.pool)).decimals;
        } catch {
          continue;
        }
        const scale = 10 ** decimals;
        const price = Number(f.fillPrice) / scale;
        const size = Number(f.quantity) / scale;
        this.ledgers[name].applyFill(f.market_id, { kind, price, size });
        this.agentState[name].fillCount = this.ledgers[name].snapshot().fillCount;
        this.journal.append({
          type: "fill",
          agent: name,
          source: "live-tail",
          marketId: f.market_id,
          data: { kind, price, size, block: f.blockNumber, tx: f.txHash },
        });
      }
    }
  }

  // -- claims -----------------------------------------------------------------

  private async sweepClaims(): Promise<void> {
    if (this.claimSweepRunning || this.cycleRunning) return;
    this.claimSweepRunning = true;
    this.lastClaimSweep = Date.now();
    try {
      for (const [name, ex] of [["GENESIS", this.maker], ["VECTOR", this.taker]] as const) {
        if (!ex.walletAddress) continue;
        try {
          const batches: Awaited<ReturnType<TempoExchange["claims"]>>[] = [];
          const longCadences = [...this.managedCadences].filter((cadence) => cadence >= 3600).sort((a, b) => b - a);
          for (const intervalSec of longCadences) batches.push(await ex.claims(60, { intervalSec }));
          batches.push(await ex.claims(60));
          const claimable = [...new Map(batches.flat().map((claim) => [claim.marketId, claim])).values()];
          for (const c of claimable) {
            const oc = await this.onchain(c.marketId, true);
            if (!oc.isResolved && !oc.isVoided) continue;
            const balances = await Promise.all([
              ex.outcomeBalance(oc, "UP"),
              ex.outcomeBalance(oc, "DOWN"),
            ]).catch(() => null);
            if (!balances) {
              this.journal.append({
                type: "error",
                agent: name,
                marketId: c.marketId,
                data: { what: "claim balance read", message: "UNAVAILABLE" },
              });
              continue;
            }
            const [heldUp, heldDown] = balances;
            if (heldUp <= 0 && heldDown <= 0) continue;
            const sides: Array<"UP" | "DOWN"> = oc.isVoided
              ? ["UP", "DOWN"]
              : oc.winningOutcome === 0
                ? ["UP"]
                : ["DOWN"];
            this.journal.append({
              type: "settlement",
              agent: name,
              source: "on-chain",
              marketId: c.marketId,
              data: {
                voided: oc.isVoided,
                winningOutcome: oc.winningOutcome,
                heldUp,
                heldDown,
                claimSides: sides,
                oracleQuestionId: c.oracleQuestionId,
              },
            });
            const managed = this.markets.get(c.marketId);
            if (managed) this.transition(managed, "CLAIM", { claimSides: sides });
            else {
              this.journal.append({
                type: "market-state",
                source: "finalized-list/on-chain",
                marketId: c.marketId,
                symbol: c.symbol,
                data: { previous: "SETTLE", lifecycle: "CLAIM", claimSides: sides },
              });
            }
            for (const side of sides) {
              const held = side === "UP" ? heldUp : heldDown;
              if (held <= 0) continue;
              try {
                const out = await ex.redeem(c.marketId, oc, side);
                this.journal.append({
                  type: "claim",
                  agent: name,
                  marketId: c.marketId,
                  tx: out.hash,
                  data: { side, amount: held },
                });
                const realized = this.ledgers[name].settle(
                  c.marketId,
                  oc.isVoided ? "VOID" : oc.winningOutcome === 0 ? "UP_WON" : "DOWN_WON",
                );
                this.agentState[name].realizedPnl += realized;
                if (managed) this.transition(managed, "ROLL", { claimTx: out.hash ?? "UNAVAILABLE" });
                else {
                  this.journal.append({
                    type: "market-state",
                    source: "finalized-list/on-chain",
                    marketId: c.marketId,
                    symbol: c.symbol,
                    data: { previous: "CLAIM", lifecycle: "ROLL", claimTx: out.hash ?? "UNAVAILABLE" },
                  });
                }
              } catch (e) {
                this.journal.append({
                  type: "error",
                  agent: name,
                  marketId: c.marketId,
                  data: { what: `redeem ${side}`, message: e instanceof Error ? e.message : String(e) },
                });
              }
            }
          }
        } catch (e) {
          this.journal.append({
            type: "error",
            agent: name,
            data: { what: "claim sweep", message: e instanceof Error ? e.message : String(e) },
          });
        }
      }
    } finally {
      this.claimSweepRunning = false;
    }
  }

  // -- agent state for the UI/CLI ----------------------------------------------

  private async refreshAgentState(): Promise<void> {
    await this.ingestFills();
    for (const [name, ex] of [["GENESIS", this.maker], ["VECTOR", this.taker]] as const) {
      try {
        const bal = await ex.collateralBalance();
        this.agentState[name].collateral = { human: bal.human, decimals: bal.decimals };
      } catch {
        this.agentState[name].collateral = null;
      }
      const positions = this.ledgers[name].snapshot().positions;
      this.agentState[name].inventory = ex.walletAddress
        ? Object.fromEntries(Object.entries(positions).map(([marketId, value]) => [marketId, { qtyUp: value.qtyUp, qtyDown: value.qtyDown }]))
        : null;
    }
  }

  private async refreshSettlements(): Promise<void> {
    try {
      const rows = await this.maker.pastMarkets({ limit: 12 });
      this.settlements = rows.slice(0, 12).map((row) => ({
        marketId: String(row.marketId ?? row.id ?? ""),
        asset: String(row.asset ?? ""),
        intervalSec: Number(row.intervalSec ?? 0),
        expiry: Number(row.expiry ?? 0),
        winningOutcome: row.winningOutcome === undefined || row.winningOutcome === null ? undefined : Number(row.winningOutcome),
        voided: Boolean(row.voided),
        tradeCount: row.tradeCount === undefined ? undefined : String(row.tradeCount),
        lastPrice: row.lastPrice === undefined || row.lastPrice === null
          ? undefined
          : Number(row.lastPrice) / 10 ** Number(row.quoteDecimals ?? row.baseDecimals),
        oracleUrl: oracleQuestionUrl(row.oracleQuestionId === undefined ? undefined : String(row.oracleQuestionId)),
        source: "indexer/on-chain" as const,
      }));
    } catch (error) {
      this.journal.append({ type: "error", data: { what: "settlement feed", message: error instanceof Error ? error.message : String(error) } });
    }
  }

  // -- snapshot for CLI/web -----------------------------------------------------

  async snapshot() {
    const nowSec = Date.now() / 1000;
    const rows = [...this.markets.values()]
      .filter((m) => m.expiry > nowSec - 300)
      .sort((a, b) => a.expiry - b.expiry)
      .map((m) => ({
        marketId: m.marketId,
        symbol: m.symbol,
        asset: m.asset,
        intervalSec: m.intervalSec,
        expiry: m.expiry,
        secondsLeft: Math.round(m.expiry - nowSec),
        managed: m.managed,
        venueId: m.venueId,
        lifecycle: m.lifecycle,
        status: m.lastStatus,
        view: this.marketViews.get(m.marketId),
      }));
    const live = {
      tailing: (() => {
        try {
          return this.maker.sdk.client.isTailing();
        } catch {
          return false;
        }
      })(),
      priceWatches: [...this.priceWatches],
      dryRun: this.cfg.dryRun,
      network: this.cfg.network,
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
    };
    return {
      at: new Date().toISOString(),
      live,
      markets: rows,
      agents: Object.values(this.agentState),
      risk: this.cfg.risk,
      settlements: this.settlements,
    };
  }
}
