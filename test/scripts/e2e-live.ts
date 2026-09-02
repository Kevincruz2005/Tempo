import { mkdirSync, writeFileSync } from "node:fs";
import { Firm, TempoServer } from "@tempo/engine";
import { loadConfig } from "@tempo/core";

const cfg = loadConfig();
const report = "test/reports/e2e-live.md";
mkdirSync("test/reports", { recursive: true });
if (!cfg.keys.maker || !cfg.keys.taker || cfg.keys.maker === cfg.keys.taker || cfg.dryRun) {
  writeFileSync(
    report,
    `# E2E Live Evidence\n\n- Run at: ${new Date().toISOString()}\n- Status: BLOCKED\n- Reason: two distinct funded keys and TEMPO_DRY_RUN=false are required; no write was attempted.\n`,
  );
  throw new Error("e2e live test requires distinct funded keys and TEMPO_DRY_RUN=false");
}

const firm = new Firm(cfg, { managedCadences: [60, 300, 900, 3600, 14400] });
const server = new TempoServer(firm, Number(process.env.TEMPO_E2E_PORT ?? 7433), new URL("../../packages/web/public/", import.meta.url).pathname);
const durationMs = Number(process.env.TEMPO_E2E_DURATION_MS ?? 180_000);
const evidenceSinceMs = Number(process.env.TEMPO_E2E_EVIDENCE_SINCE_MS ?? Date.now() - 24 * 3600_000);
try {
  await server.start();
  await firm.start();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
} finally {
  await firm.stop();
  await server.stop();
}

const records = firm.journal.readFiles(evidenceSinceMs);
const marketIds = [...new Set(records.map((record) => record.marketId).filter((id): id is string => Boolean(id)))];
const completed = marketIds.find((marketId) => {
  const marketRecords = records.filter((record) => record.marketId === marketId);
  const states = new Set(marketRecords.map((record) => record.data?.lifecycle));
  return (
    states.has("ANCHOR") &&
    states.has("GENESIS") &&
    states.has("ENDGAME") &&
    states.has("SETTLE") &&
    states.has("CLAIM") &&
    states.has("ROLL") &&
    marketRecords.some((record) => record.type === "settlement") &&
    marketRecords.some((record) => record.type === "claim" && record.tx)
  );
});
const completedRecords = completed ? records.filter((record) => record.marketId === completed) : [];
const txs = completedRecords.filter((record) => record.tx && /^0x[0-9a-f]{64}$/i.test(record.tx));
const lifecycles = [...new Set(completedRecords.map((record) => record.data?.lifecycle).filter(Boolean))];
const lines = [
  "# E2E Live Evidence",
  "",
  `- Run at: ${new Date().toISOString()}`,
  `- Duration: ${durationMs} ms`,
  `- Completed market id: ${completed ?? "NO DATA"}`,
  `- Lifecycle states observed on that market: ${lifecycles.join(", ") || "NO DATA"}`,
  `- Settlement record observed: ${completedRecords.some((record) => record.type === "settlement")}`,
  `- Confirmed claim observed: ${completedRecords.some((record) => record.type === "claim" && record.tx)}`,
  `- Real transaction hashes: ${txs.length}`,
  `- Status: ${completed ? "PASS" : "FAIL"}`,
  "",
  "## Hashes",
  "",
  ...txs.map((record) => `- ${record.type}: \`${record.tx}\``),
];
writeFileSync(report, `${lines.join("\n")}\n`);
if (!completed) throw new Error("no single real market completed ANCHOR through confirmed CLAIM and ROLL in the evidence window");
process.exit(0);
