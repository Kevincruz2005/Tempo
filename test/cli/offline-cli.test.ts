import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", "packages/cli/src/index.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, TEMPO_KEY_MAKER: "", TEMPO_KEY_TAKER: "" },
  });

describe("CLI offline behavior", () => {
  it("documents every command", () => {
    const result = run("--help");
    expect(result.status).toBe(0);
    for (const command of ["doctor", "markets", "watch", "book", "agents", "firm", "trade", "positions", "claims", "activity", "verify", "report", "settlements", "faucet", "backtest"]) {
      expect(result.stdout).toContain(command);
    }
  });

  it("refuses faucet without a key", () => {
    const result = run("faucet");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no key configured");
  });
});
