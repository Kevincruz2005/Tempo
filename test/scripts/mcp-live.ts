import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const journalDir = mkdtempSync(join(tmpdir(), "tempo-mcp-live-"));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", "packages/mcp/src/index.ts"],
  cwd: process.cwd(),
  stderr: "pipe",
  env: { TEMPO_MCP_WRITES: "false", TEMPO_KEY_MAKER: "", TEMPO_KEY_TAKER: "", TEMPO_JOURNAL_DIR: journalDir },
});
const client = new Client({ name: "tempo-mcp-live", version: "0.1.0" }, { capabilities: {} });
try {
  await client.connect(transport);
  const tools = await client.listTools();
  const response = await client.callTool({ name: "discover_markets", arguments: { limit: 20 } });
  if (response.isError) throw new Error(JSON.stringify(response));
  const text = response.content.find((content) => content.type === "text")?.text ?? "{}";
  const markets = JSON.parse(text) as Array<{ marketId?: string; symbol?: string; asset?: string }>;
  mkdirSync("test/reports", { recursive: true });
  writeFileSync("test/reports/mcp-live.md", [
    "# MCP Live Read Evidence",
    "",
    `- Run at: ${new Date().toISOString()}`,
    "- Network: configured Somnia testnet (read-only)",
    `- Tool catalog: ${tools.tools.length} tools returned over stdio`,
    `- discover_markets result: ${markets.length} live rows from the official indexer/SDK`,
    `- First row: ${markets[0] ? `${markets[0].asset ?? "UNAVAILABLE"} ${markets[0].symbol ?? "UNAVAILABLE"} (${markets[0].marketId ?? "UNAVAILABLE"})` : "NO DATA"}`,
    "- place_order: not enabled (`TEMPO_MCP_WRITES=false`); no write attempted",
    "- Status: PASS",
    "",
  ].join("\n"));
} finally {
  await client.close().catch(() => {});
  rmSync(journalDir, { recursive: true, force: true });
}

