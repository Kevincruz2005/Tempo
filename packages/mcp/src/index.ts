#!/usr/bin/env node
/**
 * TEMPO MCP adapter. Read tools are live, bounded and provenance-rich. The
 * only write tool is opt-in, signer-backed, and delegates to TempoExchange's
 * chain-gated/risk-checked path; no key is accepted over MCP.
 */
import { createHash } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  Journal,
  TempoExchange,
  TempoError,
  fairValue,
  realizedVolPerSqrtSec,
  loadConfig,
  normalizeOpeningBoundary,
  oracleQuestionUrl,
} from "@tempo/core";
import { Executor } from "@tempo/engine";

const LIMIT = z.number().int().min(1).max(50).default(20);
const marketInput = z.object({ market: z.string().min(1).max(200) }).strict();
const tradeInput = marketInput.extend({ outcome: z.enum(["UP", "DOWN"]), size: z.number().finite().positive().max(10_000), price: z.number().finite().gt(0).lt(1) }).strict();

const readToolDefinitions = [
  { name: "discover_markets", description: "List live binary Event Contract windows from the official markets SDK.", inputSchema: { type: "object", properties: { asset: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  { name: "inspect_event_contract", description: "Inspect on-chain state, live book parameters, and opening price for a market.", inputSchema: { type: "object", properties: { market: { type: "string", minLength: 1, maxLength: 200 } }, required: ["market"] } },
  { name: "get_live_book", description: "Read the SDK's locally materialized live binary book.", inputSchema: { type: "object", properties: { market: { type: "string" }, depth: { type: "integer", minimum: 1, maximum: 20 } }, required: ["market"] } },
  { name: "get_market_state", description: "Read current on-chain market status and resolution state.", inputSchema: { type: "object", properties: { market: { type: "string" } }, required: ["market"] } },
  { name: "get_fair_value", description: "Compute a deterministic AI ESTIMATE from official spot, opening boundary, realized volatility, and time.", inputSchema: { type: "object", properties: { market: { type: "string" } }, required: ["market"] } },
  { name: "get_risk_state", description: "Return configured deterministic risk caps and signer availability, never addresses or keys.", inputSchema: { type: "object", properties: {} } },
  { name: "get_positions", description: "Read real ERC-6909 outcome balances for an address or configured signer.", inputSchema: { type: "object", properties: { address: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  { name: "get_settlement", description: "Read finalized settlement facts and the oracle explorer URL.", inputSchema: { type: "object", properties: { market: { type: "string" } }, required: ["market"] } },
  { name: "get_activity", description: "Read a bounded tail of typed local journal activity.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  { name: "verify_receipt", description: "Look up a transaction receipt on the configured Somnia RPC.", inputSchema: { type: "object", properties: { hash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" } }, required: ["hash"] } },
  { name: "simulate_trade", description: "Always-dry-run trade preparation through the chain gate and RiskEngine.", inputSchema: { type: "object", properties: { market: { type: "string" }, outcome: { type: "string", enum: ["UP", "DOWN"] }, size: { type: "number" }, price: { type: "number" } }, required: ["market", "outcome", "size", "price"] } },
];
const placeOrderDefinition = { name: "place_order", description: "Opt-in MCP IOC order through the firm Executor; requires TEMPO_MCP_WRITES=true and a configured agent key.", inputSchema: { type: "object", additionalProperties: false, properties: { market: { type: "string", minLength: 1, maxLength: 200 }, outcome: { type: "string", enum: ["UP", "DOWN"] }, size: { type: "number", exclusiveMinimum: 0, maximum: 10_000 }, price: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 1 } }, required: ["market", "outcome", "size", "price"] } };

type ToolArgs = Record<string, unknown>;

export async function withToolTimeout<T>(work: Promise<T>, timeoutMs = 10_000): Promise<T> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new Error("invalid MCP timeout");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`MCP tool timeout after ${timeoutMs} milliseconds`)), timeoutMs); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createMcpServer() {
  const config = loadConfig();
  const journal = new Journal(config.journalDir, "tempo");
  journal.open();
  const reader = new TempoExchange({ config });
  const server = new Server({ name: "tempo", version: "0.1.0" }, { capabilities: { tools: {} } });
  const writesEnabled = process.env.TEMPO_MCP_WRITES === "true" && Boolean(config.keys.maker ?? config.keys.taker);
  const toolDefinitions = writesEnabled ? [...readToolDefinitions, placeOrderDefinition] : readToolDefinitions;

  const safeArgsHash = (args: ToolArgs): string => createHash("sha256").update(JSON.stringify(args)).digest("hex");
  const jsonSafe = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
  const result = (value: unknown, isError = false) => {
    const safe = jsonSafe(value);
    const structuredContent = safe && typeof safe === "object" && !Array.isArray(safe) ? safe as Record<string, unknown> : { result: safe };
    return { isError, structuredContent, content: [{ type: "text" as const, text: JSON.stringify(safe) }] };
  };
  const bounded = <T>(value: T[], max = 50): T[] => value.slice(0, max);
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as ToolArgs;
    if (JSON.stringify(args).length > 16_384) return result({ error: "MCP arguments exceed 16 KiB" }, true);
    const argsHash = safeArgsHash(args);
    try {
      if (name === "place_order" && !writesEnabled) throw new TempoError("NO_KEY", "place_order is not enabled or signer-backed");
      const value = await withToolTimeout(handleTool(name, args, config, reader, journal, LIMIT, marketInput, tradeInput, bounded));
      const tx = value && typeof value === "object" && typeof (value as { tx?: unknown }).tx === "string" ? (value as { tx: string }).tx : undefined;
      journal.append({ type: "mcp", agent: "MCP", source: "mcp-stdio", tx, data: { tool: name, argsHash, result: "success" } });
      return result(value);
    } catch (error) {
      const message = error instanceof TempoError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
      journal.append({ type: "mcp", agent: "MCP", source: "mcp-stdio", data: { tool: name, argsHash, result: "error", code: error instanceof TempoError ? error.code : "ERROR" } });
      return result({ error: message }, true);
    }
  });

  const close = async (): Promise<void> => { await reader.close(); await journal.close(); await server.close(); };
  return { server, close };
}

async function handleTool(
  name: string,
  args: ToolArgs,
  config: ReturnType<typeof loadConfig>,
  reader: TempoExchange,
  journal: Journal,
  limitSchema: z.ZodDefault<z.ZodNumber>,
  marketSchema: typeof marketInput,
  tradeSchema: typeof tradeInput,
  bounded: <T>(value: T[], max?: number) => T[],
): Promise<unknown> {
  const resolveLive = async (ref: string) => {
    const lowered = ref.toLowerCase();
    const rows = await reader.sdk.client.listLiveBinaryMarkets({ limit: 50 });
    return rows.find((candidate) => candidate.marketId.toLowerCase() === lowered || candidate.asset.toLowerCase() === lowered || candidate.question.toLowerCase().includes(lowered));
  };
  const openingFor = async (row: Awaited<ReturnType<typeof resolveLive>>) => {
    if (!row) return undefined;
    const [spot, boundary] = await Promise.all([
      reader.spot(row.asset),
      row.mode === "fixed"
        ? Promise.resolve(row.strike as unknown)
        : reader.sdk.client.getOpeningPrices([row.marketId]).then((values) => values?.[row.marketId.toLowerCase()]),
    ]);
    if (!spot) return undefined;
    return normalizeOpeningBoundary(boundary, spot.price);
  };
  switch (name) {
    case "discover_markets": {
      const parsed = z.object({ asset: z.string().min(1).max(20).optional(), limit: limitSchema }).strict().parse(args);
      // The client-tier live query is the cheap discovery path; unified market
      // hydration is intentionally reserved for tools that need outcome symbols.
      const rows = await reader.sdk.client.listLiveBinaryMarkets({ asset: parsed.asset?.toUpperCase() });
      return bounded(rows, parsed.limit);
    }
    case "inspect_event_contract": {
      const { market } = marketSchema.parse(args);
      const row = await resolveLive(market);
      if (!row) throw new TempoError("UNAVAILABLE", `market not found: ${market}`);
      const [state, params, openingPrice] = await Promise.all([
        reader.onchain(row.marketId),
        reader.bookParams(row.poolAddress),
        openingFor(row),
      ]);
      return { market: row, onchain: state, bookParams: params, openingPrice };
    }
    case "get_live_book": {
      const parsed = z.object({ market: z.string().min(1).max(200), depth: z.number().int().min(1).max(20).default(10) }).strict().parse(args);
      const row = await resolveLive(parsed.market);
      if (!row) throw new TempoError("UNAVAILABLE", `market not found: ${parsed.market}`);
      const state = await reader.onchain(row.marketId);
      const params = await reader.bookParams(state.pool);
      return { marketId: row.marketId, question: row.question, source: "on-chain book via markets SDK", book: await reader.sdk.client.getBinaryOrderBook(state.pool as `0x${string}`, { depth: parsed.depth, decimals: params.decimals }) };
    }
    case "get_market_state": {
      const { market } = marketSchema.parse(args);
      const row = await resolveLive(market);
      if (!row) throw new TempoError("UNAVAILABLE", `market not found: ${market}`);
      return { marketId: row.marketId, question: row.question, state: await reader.onchain(row.marketId), source: "on-chain" };
    }
    case "get_fair_value": {
      const { market } = marketSchema.parse(args);
      const row = await resolveLive(market);
      if (!row) throw new TempoError("UNAVAILABLE", `market not found: ${market}`);
      const [spot, strike, history] = await Promise.all([
        reader.spot(row.asset),
        openingFor(row),
        reader.spotHistory(row.asset, { limit: 240 }),
      ]);
      if (!spot || strike === undefined) return { label: "AI ESTIMATE", status: "NO DATA", inputs: { spot: "UNAVAILABLE", strike: "UNAVAILABLE", sigma: "UNAVAILABLE", secondsLeft: Math.max(0, Number(row.expiry) - Date.now() / 1000) } };
      const sigma = realizedVolPerSqrtSec(history);
      const secondsLeft = Math.max(0, Number(row.expiry) - Date.now() / 1000);
      const estimate = fairValue({ spot: spot.price, strike, sigmaPerSqrtSec: sigma, secondsLeft });
      if (!Number.isFinite(sigma) || !Number.isFinite(estimate.p)) {
        return { label: "AI ESTIMATE", status: "NO DATA", reason: "insufficient valid official price-feed history", inputs: { spot: spot.price, strike, sigma: "UNAVAILABLE", secondsLeft, samples: history.length }, provenance: { spot: "official price feed", strike: "on-chain opening price" } };
      }
      return { label: "AI ESTIMATE", value: estimate, inputs: { spot: spot.price, strike, sigma, secondsLeft, samples: history.length }, provenance: { spot: "official price feed", strike: "on-chain opening price" } };
    }
    case "get_risk_state":
      z.object({}).strict().parse(args);
      return { source: "TEMPO config", dryRun: config.dryRun, hasMakerSigner: Boolean(config.keys.maker), hasTakerSigner: Boolean(config.keys.taker), caps: config.risk };
    case "get_positions": {
      const parsed = z.object({ address: z.string().regex(/^0x[0-9a-f]{40}$/i).optional(), limit: limitSchema }).strict().parse(args);
      return bounded(await reader.positions(parsed.address, parsed.limit), parsed.limit);
    }
    case "get_settlement": {
      const { market } = marketSchema.parse(args);
      const state = await reader.onchain(market);
      const resolution = await reader.resolution(market);
      return { marketId: market, state, resolution, oracleUrl: oracleQuestionUrl(typeof resolution?.oracleQuestionId === "string" ? resolution.oracleQuestionId : undefined), source: "on-chain/indexer" };
    }
    case "get_activity": {
      const parsed = z.object({ limit: limitSchema }).strict().parse(args);
      return bounded(journal.readFiles().slice(-parsed.limit), parsed.limit);
    }
    case "verify_receipt": {
      const parsed = z.object({ hash: z.string().regex(/^0x[0-9a-f]{64}$/i) }).strict().parse(args);
      return await reader.verifyReceipt(parsed.hash);
    }
    case "simulate_trade": {
      const parsed = tradeSchema.parse(args);
      const prepared = await reader.prepareTrade(parsed.market, parsed.outcome, parsed.size, parsed.price);
      return { mode: "DRY_RUN", verdict: prepared.verdict, market: prepared.market.symbol, outcome: prepared.outcome, size: prepared.size, price: prepared.price, expireTimestampNs: prepared.expireTimestampNs.toString(), secondsLeft: prepared.secondsLeft, worstCaseCost: prepared.worstCaseCost };
    }
    case "place_order": {
      const parsed = tradeSchema.parse(args);
      if (process.env.TEMPO_MCP_WRITES !== "true") throw new TempoError("NO_KEY", "place_order disabled; set TEMPO_MCP_WRITES=true explicitly");
      const key = config.keys.taker ?? config.keys.maker;
      if (!key) throw new TempoError("NO_KEY", "place_order requires a configured agent signer");
      const writer = new TempoExchange({ config, privateKey: key });
      try {
        const prepared = await writer.prepareTrade(parsed.market, parsed.outcome, parsed.size, parsed.price);
        const params = await writer.bookParams(prepared.onchain.pool);
        const executor = new Executor(writer, journal, "MCP", false);
        const execution = await executor.executeTakerPlan(
          { ...prepared.market, pool: prepared.onchain.pool },
          { kind: parsed.outcome === "UP" ? "BUY_UP" : "BUY_DOWN", price: prepared.price, size: prepared.size, edgeObserved: 0, reason: "explicit MCP operator order" },
          params,
        );
        if (execution.errors.length || !execution.hashes[0]) throw new TempoError("UNAVAILABLE", execution.errors[0]?.message ?? "MCP order returned no mined transaction hash");
        return { mode: "LIVE", market: prepared.market.symbol, outcome: parsed.outcome, tx: execution.hashes[0], status: "success", sent: execution.sent };
      } finally {
        await writer.close();
      }
    }
    default:
      throw new Error(`unknown MCP tool: ${name}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server } = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
