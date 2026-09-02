import { mkdirSync, writeFileSync } from "node:fs";
import { createPublicClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { TempoExchange, loadConfig } from "@tempo/core";

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
if (makerGas < parseEther("1") || takerGas < parseEther("1")) {
  lines.push(
    "- Status: BLOCKED",
    `- Reason: native STT preflight failed (GENESIS ${formatEther(makerGas)}, VECTOR ${formatEther(takerGas)}; require >=1 each).`,
  );
  writeReport(lines);
  throw new Error("fund both agent addresses with STT from the official Somnia Shannon faucet");
}

const maker = new TempoExchange({ config: cfg, privateKey: cfg.keys.maker });
const taker = new TempoExchange({ config: cfg, privateKey: cfg.keys.taker });
const evidence: Array<{ action: string; hash: string }> = [];
const record = (action: string, hash?: string): void => {
  if (!hash || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error(`${action} returned no real transaction hash`);
  evidence.push({ action, hash });
};

try {
  const markets = await maker.markets({ maxAgeMs: 0 });
  let market;
  for (const candidate of markets.filter((row) => row.expiry > Date.now() / 1000 + 120).sort((a, b) => a.expiry - b.expiry)) {
    if ((await maker.onchain(candidate.marketId)).status === 1) {
      market = candidate;
      break;
    }
  }
  if (!market) throw new Error("no Trading window with at least 120 seconds remaining");
  lines.push(`- Market: ${market.symbol}`, `- Market id: ${market.marketId}`);

  record("GENESIS faucet", (await maker.faucet()).hash);
  record("VECTOR faucet", (await taker.faucet()).hash);
  record("GENESIS mintSet", (await maker.mintSet(market.symbol, 2)).hash);

  const onchain = await maker.onchain(market.marketId);
  const params = await maker.bookParams(onchain.pool);
  const resting = await maker.place(market.upSymbol, "buy", 1, params.tick, { postOnly: true });
  record("GENESIS post-only quote", resting.hash);
  if (!resting.orderId) throw new Error("post-only quote did not return an order id");
  record("GENESIS cancel", (await maker.cancel(resting.orderId, market.upSymbol)).hash);

  const book = await maker.book(market.upSymbol, 3);
  const ask = Math.min(1 - params.tick, (book.bids[0]?.price ?? 0.5) + 2 * params.tick);
  const makerAsk = await maker.place(market.upSymbol, "sell", 1, ask, { postOnly: true });
  record("GENESIS post-only sell", makerAsk.hash);
  const take = await taker.trade(market.marketId, "UP", 1, ask);
  record("VECTOR IOC take", take.hash);

  if (makerAsk.orderId) {
    const remaining = (await maker.openOrders(market.upSymbol)).some((order) => order.id === makerAsk.orderId);
    if (remaining) await maker.cancel(makerAsk.orderId, market.upSymbol);
  }

  const deadline = market.expiry * 1000 + 10 * 60_000;
  let finalized = await maker.onchain(market.marketId);
  while (!finalized.isResolved && !finalized.isVoided && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    finalized = await maker.onchain(market.marketId);
  }
  if (finalized.isResolved || finalized.isVoided) {
    for (const [agent, exchange] of [["GENESIS", maker], ["VECTOR", taker]] as const) {
      for (const result of await exchange.claim(market.marketId)) {
        if (result.hash) record(`${agent} redeem ${result.outcome}`, result.hash);
      }
    }
  } else {
    lines.push("- Settlement: PENDING at runner deadline; no redeem hash claimed.");
  }

  lines.push("- Status: PASS", "", "## Transaction Hashes", "");
  for (const item of evidence) lines.push(`- ${item.action}: \`${item.hash}\``);
  writeReport(lines);
} catch (error) {
  lines.push("- Status: FAIL", `- Error: ${error instanceof Error ? error.message : String(error)}`, "", "## Confirmed Hashes Before Failure", "");
  for (const item of evidence) lines.push(`- ${item.action}: \`${item.hash}\``);
  writeReport(lines);
  throw error;
} finally {
  await Promise.allSettled([maker.close(), taker.close()]);
}
