import { mkdirSync, writeFileSync } from "node:fs";
import { createPublicClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ContractRevertError } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { Journal, TempoExchange, loadConfig, type BinaryMarketInfo } from "@tempo/core";

const cfg = loadConfig();
const reportPath = "test/reports/contract-live.md";
mkdirSync("test/reports", { recursive: true });

function writeReport(lines: string[]): void {
  writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
}

const lines = ["# Contract Live Evidence", "", `- Run at: ${new Date().toISOString()}`, `- Network: ${cfg.network} (${somniaShannon.id})`];
if (!cfg.keys.maker || !cfg.keys.taker) {
  lines.push("- Status: BLOCKED", "- Reason: TEMPO_KEY_MAKER and TEMPO_KEY_TAKER are required; no transaction was attempted.");
  writeReport(lines);
  throw new Error("contract live test requires two configured keys");
}
if (cfg.keys.maker === cfg.keys.taker) {
  lines.push("- Status: BLOCKED", "- Reason: maker and taker keys must be distinct.");
  writeReport(lines);
  throw new Error("maker and taker keys must be distinct");
}

const rpc = createPublicClient({ chain: somniaShannon, transport: http(cfg.endpoints.rpcUrl) });
const makerAccount = privateKeyToAccount(cfg.keys.maker);
const takerAccount = privateKeyToAccount(cfg.keys.taker);
const [makerGas, takerGas] = await Promise.all([
  rpc.getBalance({ address: makerAccount.address }),
  rpc.getBalance({ address: takerAccount.address }),
]);
lines.push(`- GENESIS address: ${makerAccount.address}`, `- VECTOR address: ${takerAccount.address}`);
const minimumGas = parseEther("0.65");
if (makerGas < minimumGas || takerGas < minimumGas) {
  lines.push(
    "- Status: BLOCKED",
    `- Reason: native STT preflight failed (GENESIS ${formatEther(makerGas)}, VECTOR ${formatEther(takerGas)}; require >=0.65 each).`,
  );
  writeReport(lines);
  throw new Error("fund both agent addresses with STT from the official Somnia Shannon faucet");
}

const maker = new TempoExchange({ config: cfg, privateKey: cfg.keys.maker });
const taker = new TempoExchange({ config: cfg, privateKey: cfg.keys.taker });
const journal = new Journal(cfg.journalDir, "tempo");
journal.open();
const evidence: Array<{ action: string; hash: string }> = [];
let market: BinaryMarketInfo | undefined;
const flush = (status: "RUNNING" | "PASS" | "FAIL", error?: string): void => {
  writeReport([
    ...lines,
    `- Status: ${status}`,
    ...(error ? [`- Error: ${error}`] : []),
    "",
    "## Confirmed Transaction Hashes",
    "",
    ...evidence.map((item) => `- ${item.action}: \`${item.hash}\``),
  ]);
};
const record = (action: string, hash?: string, context: { marketId?: string; symbol?: string } = {}): void => {
  if (!hash || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error(`${action} returned no real transaction hash`);
  evidence.push({ action, hash });
  journal.append({
    type: action.includes("cancel") ? "order-cancelled" : action.includes("redeem") ? "claim" : "order-receipt",
    agent: action.startsWith("GENESIS") ? "GENESIS" : action.startsWith("VECTOR") ? "VECTOR" : undefined,
    source: "Somnia Shannon confirmed receipt",
    marketId: context.marketId ?? market?.marketId,
    symbol: context.symbol ?? market?.symbol,
    data: { action, contractEvidence: true },
    tx: hash,
  });
  flush("RUNNING");
};

try {
  const selectionDeadline = Date.now() + 6 * 60_000;
  while (!market && Date.now() < selectionDeadline) {
    const now = Date.now() / 1000;
    const candidates = (await maker.markets({ maxAgeMs: 0 }))
      .filter((row) => row.expiry > now + 90)
      .sort((a, b) => a.expiry - b.expiry);
    for (const candidate of candidates) {
      if ((await maker.onchain(candidate.marketId)).status === 1) {
        market = candidate;
        break;
      }
    }
    if (!market) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!market) throw new Error("no Trading window with at least 90 seconds remaining after 6 minutes");
  lines.push(`- Market: ${market.symbol}`, `- Market id: ${market.marketId}`);
  flush("RUNNING");

  record("GENESIS faucet", (await maker.faucet()).hash);
  record("VECTOR faucet", (await taker.faucet()).hash);
  record("GENESIS mintSet", (await maker.mintSet(market.symbol, 2)).hash);

  const onchain = await maker.onchain(market.marketId);
  const params = await maker.bookParams(onchain.pool);
  const resting = await maker.place(market.upSymbol, "buy", 1, params.tick, { postOnly: true });
  record("GENESIS post-only quote", resting.hash);
  if (!resting.orderId) throw new Error("post-only quote did not return an order id");
  record("GENESIS cancel", (await maker.cancel(resting.orderId, market.upSymbol)).hash);

  let ask = 0;
  let makerAsk: Awaited<ReturnType<TempoExchange["place"]>> | undefined;
  for (let attempt = 1; attempt <= 5 && !makerAsk; attempt++) {
    const book = await maker.book(market.upSymbol, 5);
    const bestBid = book.bids[0]?.price ?? params.tick;
    const bestAsk = book.asks[0]?.price;
    ask = Math.min(1 - params.tick, Math.max(bestBid + 5 * params.tick, bestAsk ?? 0.5));
    try {
      makerAsk = await maker.place(market.upSymbol, "sell", 1, ask, { postOnly: true });
    } catch (error) {
      if (!(error instanceof ContractRevertError) || error.errorName !== "PostOnlyWouldCross") throw error;
      lines.push(`- PostOnlyWouldCross attempt ${attempt}: live book moved; re-quoting.`);
      flush("RUNNING");
    }
  }
  if (!makerAsk) throw new Error("post-only sell crossed after 5 live re-quotes");
  record("GENESIS post-only sell", makerAsk.hash);
  const take = await taker.trade(market.marketId, "UP", 1, ask);
  record("VECTOR IOC take", take.hash);

  if (makerAsk.orderId) {
    const remaining = (await maker.openOrders(market.upSymbol)).some((order) => order.id === makerAsk.orderId);
    if (remaining) await maker.cancel(makerAsk.orderId, market.upSymbol);
  }

  let claimMarketId = market.marketId;
  let claimSymbol: string | undefined = market.symbol;
  let finalized = await maker.onchain(claimMarketId);
  if (!finalized.isResolved && !finalized.isVoided && market.expiry * 1000 - Date.now() <= 15 * 60_000) {
    const deadline = market.expiry * 1000 + 10 * 60_000;
    while (!finalized.isResolved && !finalized.isVoided && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      finalized = await maker.onchain(claimMarketId);
    }
  }
  if (!finalized.isResolved && !finalized.isVoided && process.env.TEMPO_REDEEM_MARKET_ID) {
    claimMarketId = process.env.TEMPO_REDEEM_MARKET_ID;
    claimSymbol = undefined;
    finalized = await maker.onchain(claimMarketId);
    lines.push(`- Redemption recovery market: ${claimMarketId} (revalidated on-chain).`);
  }
  let redeemCount = 0;
  if (finalized.isResolved || finalized.isVoided) {
    for (const [agent, exchange] of [["GENESIS", maker], ["VECTOR", taker]] as const) {
      for (const result of await exchange.claim(claimMarketId)) {
        if (result.hash) {
          redeemCount++;
          record(`${agent} redeem ${result.outcome}`, result.hash, { marketId: claimMarketId, symbol: claimSymbol });
        }
      }
    }
  }
  if (redeemCount === 0) throw new Error("no real redemption hash was produced; provide a finalized TEMPO_REDEEM_MARKET_ID with an on-chain position");

  flush("PASS");
} catch (error) {
  flush("FAIL", error instanceof Error ? error.message : String(error));
  throw error;
} finally {
  await journal.close();
  await Promise.allSettled([maker.close(), taker.close()]);
}
process.exit(0);
