import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { withToolTimeout } from "../../packages/mcp/src/index.js";

describe("MCP stdio boundary", () => {
  it("exposes only read tools when writes are not explicitly signer-backed", async () => {
    const journalDir = mkdtempSync(join(tmpdir(), "tempo-mcp-"));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "packages/mcp/src/index.ts"],
      cwd: process.cwd(),
      stderr: "pipe",
      env: { TEMPO_MCP_WRITES: "false", TEMPO_KEY_MAKER: "", TEMPO_KEY_TAKER: "", TEMPO_JOURNAL_DIR: journalDir },
    });
    const client = new Client({ name: "tempo-test", version: "0.1.0" }, { capabilities: {} });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("discover_markets");
      expect(tools.tools).toHaveLength(11);
      expect(tools.tools.map((tool) => tool.name)).not.toContain("place_order");
      const risk = await client.callTool({ name: "get_risk_state", arguments: {} });
      expect(risk.isError).not.toBe(true);
      expect(risk.structuredContent).toMatchObject({ source: "TEMPO config", hasMakerSigner: false, hasTakerSigner: false });
      const malformed = await client.callTool({ name: "get_risk_state", arguments: { unexpected: true } });
      expect(malformed.isError).toBe(true);
      const oversized = await client.callTool({ name: "get_risk_state", arguments: { padding: "x".repeat(17_000) } });
      expect(oversized.isError).toBe(true);
      expect(JSON.stringify(oversized)).toContain("16 KiB");
    } finally {
      await client.close().catch(() => {});
      rmSync(journalDir, { recursive: true, force: true });
    }
  }, 20_000);

  it("bounds stalled tools with an explicit timeout", async () => {
    await expect(withToolTimeout(new Promise(() => {}), 5)).rejects.toThrow(/timeout/);
    await expect(withToolTimeout(Promise.resolve("ok"), 5)).resolves.toBe("ok");
    await expect(withToolTimeout(Promise.resolve("ok"), 90_001)).rejects.toThrow(/invalid/);
  });
});
