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

const firm = new Firm(cfg);
const server = new TempoServer(firm, Number(process.env.TEMPO_E2E_PORT ?? 7433), new URL("../../packages/web/public/", import.meta.url).pathname);
const durationMs = Number(process.env.TEMPO_E2E_DURATION_MS ?? 180_000);
try {
  await server.start();
  await firm.start();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
} finally {
  await firm.stop();
  await server.stop();
}

const records = firm.journal.tail(2000);
const txs = records.filter((record) => record.tx && /^0x[0-9a-f]{64}$/i.test(record.tx));
const lifecycles = [...new Set(records.map((record) => record.data?.lifecycle).filter(Boolean))];
const lines = [
  "# E2E Live Evidence",
  "",
  `- Run at: ${new Date().toISOString()}`,
  `- Duration: ${durationMs} ms`,
  `- Lifecycle states observed: ${lifecycles.join(", ") || "NO DATA"}`,
  `- Real transaction hashes: ${txs.length}`,
  `- Status: ${txs.length > 0 ? "PASS" : "FAIL"}`,
  "",
  "## Hashes",
  "",
  ...txs.map((record) => `- ${record.type}: \`${record.tx}\``),
];
writeFileSync(report, `${lines.join("\n")}\n`);
if (txs.length === 0) throw new Error("no real transaction hashes observed during e2e run");
