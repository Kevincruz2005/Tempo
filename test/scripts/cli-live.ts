import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

mkdirSync("test/reports", { recursive: true });
const commands: Array<{ name: string; args: string[]; timeout?: number }> = [
  { name: "doctor", args: ["doctor"] },
  { name: "markets", args: ["markets"] },
  { name: "book", args: ["book", "BTC"] },
  { name: "agents", args: ["agents"] },
  { name: "positions", args: ["positions"] },
  { name: "claims", args: ["claims", "--limit", "3"] },
  { name: "activity", args: ["activity", "--n", "5"] },
  { name: "verify", args: ["verify"] },
  { name: "settlements", args: ["settlements", "--limit", "3"] },
  { name: "backtest", args: ["backtest", "--limit", "3"] },
  { name: "watch", args: ["watch", "--asset", "BTC"], timeout: 20_000 },
  { name: "firm", args: ["firm", "simulate", "--port", "7533"], timeout: 25_000 },
];
const results = commands.map((command) => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "packages/cli/src/index.ts", ...command.args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: command.timeout ?? 45_000,
    killSignal: "SIGTERM",
  });
  const timed = result.error && "code" in result.error && result.error.code === "ETIMEDOUT";
  return { name: command.name, ok: result.status === 0 || (Boolean(command.timeout) && timed), status: result.status, timed, output: `${result.stdout}${result.stderr}`.slice(0, 4000) };
});
const lines = ["# CLI Live Report", "", `- Run at: ${new Date().toISOString()}`, "", ...results.map((result) => `## ${result.name}\n\n- Status: ${result.ok ? "PASS" : "FAIL"}\n- Exit: ${result.status ?? "timeout"}\n\n\`\`\`text\n${result.output}\n\`\`\``)];
writeFileSync("test/reports/cli-live.md", `${lines.join("\n")}\n`);
if (results.some((result) => !result.ok)) throw new Error("one or more live CLI commands failed");
