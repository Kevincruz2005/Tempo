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
const results: Array<{ tool: string; ok: boolean; attempts: number; detail: string }> = [];

async function call(tool: string, args: Record<string, unknown>): Promise<unknown> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await client.callTool({ name: tool, arguments: args });
    const body = response.content.find((content) => content.type === "text")?.text ?? "{}";
    if (!response.isError) {
      results.push({ tool, ok: true, attempts: attempt, detail: body.slice(0, 240) });
      return JSON.parse(body);
    }
    if (!body.includes("MCP tool timeout") || attempt === 3) {
      results.push({ tool, ok: false, attempts: attempt, detail: body.slice(0, 240) });
      throw new Error(`${tool}: ${body}`);
    }
  }
  throw new Error(`${tool}: retry bound exhausted`);
}

try {
  await client.connect(transport);
  const tools = await client.listTools();
  if (tools.tools.some((tool) => tool.name === "place_order")) throw new Error("place_order must not be advertised in read-only mode");
  const markets = await call("discover_markets", { limit: 50 }) as Array<{ marketId?: string; symbol?: string; asset?: string; expiry?: number }>;
  const market = [...markets].filter((row) => row.marketId).sort((a, b) => Number(b.expiry ?? 0) - Number(a.expiry ?? 0))[0];
  if (!market?.marketId) throw new Error("discover_markets returned no live market id");

  await call("inspect_event_contract", { market: market.marketId });
  await call("get_live_book", { market: market.marketId, depth: 5 });
  await call("get_market_state", { market: market.marketId });
  await call("get_fair_value", { market: market.marketId });
  await call("get_risk_state", {});
  await call("get_positions", { address: "0xE7a8a7d81Bad87512f9cab931E5122B5eaEE8c7a", limit: 10 });
  await call("get_settlement", { market: "0x0000000000000000000000000000000000000000000000000000000000010fad" });
  await call("get_activity", { limit: 10 });
  await call("verify_receipt", { hash: "0x3d2cc41de74db30eb8811609cdee105e9657a7dce2b463236b3a5618a6b26079" });
  await call("simulate_trade", { market: market.marketId, outcome: "UP", size: 0.001, price: 0.5 });

  mkdirSync("test/reports", { recursive: true });
  writeFileSync("test/reports/mcp-live.md", [
    "# MCP Live Read Evidence",
    "",
    `- Run at: ${new Date().toISOString()}`,
    "- Network: configured Somnia testnet (read-only)",
    `- Advertised catalog: ${tools.tools.length} read/simulation tools; place_order absent`,
    `- Selected live market: ${market.asset ?? "UNAVAILABLE"} ${market.symbol ?? "UNAVAILABLE"} (${market.marketId})`,
    `- Tools passed: ${results.filter((result) => result.ok).length}/${results.length}`,
    "- Every result crossed MCP stdio and returned live/core-derived data; no network substitute was used.",
    "- Status: PASS",
    "",
    "## Tool Matrix",
    "",
    "| Tool | Status | Attempts | Bounded evidence excerpt |",
    "| --- | --- | ---: | --- |",
    ...results.map((result) => `| \`${result.tool}\` | ${result.ok ? "PASS" : "FAIL"} | ${result.attempts} | \`${result.detail.replace(/\|/g, "\\|").replace(/`/g, "'")}\` |`),
    "",
  ].join("\n"));
} finally {
  await client.close().catch(() => {});
  rmSync(journalDir, { recursive: true, force: true });
}
