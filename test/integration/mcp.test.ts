import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("MCP stdio boundary", () => {
  it("exposes the complete tool catalog and refuses writes by default", async () => {
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
      expect(tools.tools).toHaveLength(12);
      const refused = await client.callTool({ name: "place_order", arguments: { market: `0x${"0".repeat(64)}`, outcome: "UP", size: 1, price: 0.5 } });
      expect(refused.isError).toBe(true);
      expect(JSON.stringify(refused)).toContain("disabled");
    } finally {
      await client.close().catch(() => {});
      rmSync(journalDir, { recursive: true, force: true });
    }
  }, 20_000);
});
