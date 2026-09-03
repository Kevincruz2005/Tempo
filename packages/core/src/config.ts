/**
 * TEMPO configuration. Endpoints default to the official DreamDEX/Somnia
 * deployment (verified in docs/RECONNAISSANCE.md); every value is overridable
 * by env. Keys are optional — without them TEMPO runs read-only and refuses
 * writes with a typed NO_KEY error rather than pretending.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  SOMNIA_MAINNET_ADDRESSES,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
  type SomniaMarketsAddresses,
  type PriceFeedConfig,
} from "@somnia-chain/markets-sdk";

export type Network = "testnet" | "mainnet";

export interface Endpoints {
  rpcUrl: string;
  wsRpcUrl: string;
  indexerUrl: string;
  restApiUrl: string;
  wsApiUrl: string;
  explorerUrl: string;
  priceFeed?: PriceFeedConfig;
}

const ENDPOINTS: Record<Network, Endpoints> = {
  testnet: {
    rpcUrl: "https://api.infra.testnet.somnia.network",
    wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
    indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
    restApiUrl: "https://stg.api.dreamdex.io/v0",
    wsApiUrl: "wss://stg.api.dreamdex.io/v0/ws/public",
    explorerUrl: "https://shannon-explorer.somnia.network",
    priceFeed: SOMNIA_TESTNET_PRICE_FEED,
  },
  mainnet: {
    rpcUrl: "https://api.infra.mainnet.somnia.network",
    wsRpcUrl: "wss://api.infra.mainnet.somnia.network/ws",
    indexerUrl: "https://prd.smk.somnia.host/v1/graphql",
    restApiUrl: "https://api.dreamdex.io/v0",
    wsApiUrl: "wss://api.dreamdex.io/v0/ws/public",
    explorerUrl: "https://explorer.somnia.network",
  },
};

/** Risk limits — every agent plan must pass RiskEngine before execution. */
export interface RiskConfig {
  /** Contracts quoted per side per window (outcome tokens). */
  quoteSize: number;
  /** Max net inventory per window, in contracts (signed: + long Up). */
  maxNetInventory: number;
  /** Max gross inventory per window (|up| + |down|). */
  maxGrossInventory: number;
  /** Firm-wide capital cap per agent, in collateral units (human). */
  firmCapitalCap: number;
  /** Max collateral committed per single order (human units). */
  maxOrderCollateral: number;
  /** Maximum live orders per market window. */
  maxOpenOrdersPerWindow: number;
  /** Maximum realized loss tolerated per market window. */
  maxLossPerWindow: number;
  /** Min seconds left before the maker stops quoting (scaled to cadence if 0). */
  minLeftSecMaker: number;
  /** Min seconds left before the taker stops acting. */
  minLeftSecTaker: number;
  /** Taker edge threshold (probability units) over fair value. */
  takerEdge: number;
  /** Maker half-spread at cycle start, in probability units. */
  halfSpread0: number;
  /** Minimum half-spread at endgame, in probability units. */
  halfSpreadMin: number;
}

export const DEFAULT_RISK: RiskConfig = {
  quoteSize: 25,
  maxNetInventory: 60,
  maxGrossInventory: 120,
  firmCapitalCap: 2000,
  maxOrderCollateral: 60,
  maxOpenOrdersPerWindow: 8,
  maxLossPerWindow: 150,
  minLeftSecMaker: 0, // scaled to cadence: max(20s, 10% of interval)
  minLeftSecTaker: 5,
  takerEdge: 0.04,
  halfSpread0: 0.03,
  halfSpreadMin: 0.006,
};

export interface AgentKeys {
  maker?: `0x${string}`;
  taker?: `0x${string}`;
}

export interface TempoConfig {
  network: Network;
  endpoints: Endpoints;
  addresses: SomniaMarketsAddresses;
  keys: AgentKeys;
  risk: RiskConfig;
  /** When true, plans are journaled but never sent (default for firm runs). */
  dryRun: boolean;
  /** Emergency application kill switch. When true every write boundary refuses. */
  paused: boolean;
  /** Directory for the JSONL journal. */
  journalDir: string;
  /** Underlying assets to trade. */
  assets: string[];
  /** Optional live venue filter. Venue ids are discovered, never defaulted. */
  venueId?: string;
}

function loadDotEnv(startDir = process.cwd()): void {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      for (const line of readFileSync(candidate, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

const num = (name: string, def: number, min: number, max: number, integer = false): number => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name}="${raw}" is not a number`);
  if (n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`${name}=${raw} must be ${integer ? "an integer " : ""}from ${min} to ${max}`);
  return n;
};

const text = (name: string, def: string): string => process.env[name]?.trim() || def;

const bool = (name: string, def: boolean): boolean => {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return def;
  if (raw !== "true" && raw !== "false") throw new Error(`${name} must be true or false`);
  return raw === "true";
};

const endpoint = (name: string, value: string, protocols: readonly string[]): string => {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${name} is not a valid URL`); }
  if (!protocols.includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) {
    throw new Error(`${name} must use ${protocols.join(" or ")} without embedded credentials`);
  }
  return parsed.toString().replace(/\/$/, "");
};

const key = (name: string): `0x${string}` | undefined => {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error(`${name} is not a valid 32-byte hex private key`);
  return raw as `0x${string}`;
};

export function loadConfig(startDir = process.cwd()): TempoConfig {
  loadDotEnv(startDir);
  const raw = text("TEMPO_NETWORK", "testnet").toLowerCase();
  if (raw !== "testnet" && raw !== "mainnet") throw new Error(`TEMPO_NETWORK="${raw}" invalid`);
  const network = raw as Network;
  const base = ENDPOINTS[network];
  const endpoints: Endpoints = {
    ...base,
    rpcUrl: endpoint("TEMPO_RPC_URL", text("TEMPO_RPC_URL", base.rpcUrl), ["https:", "http:"]),
    wsRpcUrl: endpoint("TEMPO_WS_RPC_URL", text("TEMPO_WS_RPC_URL", base.wsRpcUrl), ["wss:", "ws:"]),
    indexerUrl: endpoint("TEMPO_INDEXER_URL", text("TEMPO_INDEXER_URL", base.indexerUrl), ["https:", "http:"]),
    explorerUrl: endpoint("TEMPO_EXPLORER_URL", text("TEMPO_EXPLORER_URL", base.explorerUrl), ["https:", "http:"]),
  };
  const risk: RiskConfig = {
    quoteSize: num("TEMPO_QUOTE_SIZE", DEFAULT_RISK.quoteSize, 0.001, 1_000_000),
    maxNetInventory: num("TEMPO_MAX_NET_INVENTORY", DEFAULT_RISK.maxNetInventory, 0.001, 10_000_000),
    maxGrossInventory: num("TEMPO_MAX_GROSS_INVENTORY", DEFAULT_RISK.maxGrossInventory, 0.001, 10_000_000),
    firmCapitalCap: num("TEMPO_FIRM_CAPITAL_CAP", DEFAULT_RISK.firmCapitalCap, 0.01, 1_000_000_000),
    maxOrderCollateral: num("TEMPO_MAX_ORDER_COLLATERAL", DEFAULT_RISK.maxOrderCollateral, 0.01, 1_000_000_000),
    maxOpenOrdersPerWindow: num("TEMPO_MAX_OPEN_ORDERS", DEFAULT_RISK.maxOpenOrdersPerWindow, 1, 1_000, true),
    maxLossPerWindow: num("TEMPO_MAX_WINDOW_LOSS", DEFAULT_RISK.maxLossPerWindow, 0.01, 1_000_000_000),
    minLeftSecMaker: num("TEMPO_MIN_LEFT_MAKER", DEFAULT_RISK.minLeftSecMaker, 0, 86_400),
    minLeftSecTaker: num("TEMPO_MIN_LEFT_TAKER", DEFAULT_RISK.minLeftSecTaker, 0, 86_400),
    takerEdge: num("TEMPO_TAKER_EDGE", DEFAULT_RISK.takerEdge, 0, 0.5),
    halfSpread0: num("TEMPO_HALF_SPREAD", DEFAULT_RISK.halfSpread0, 0.000001, 0.5),
    halfSpreadMin: num("TEMPO_HALF_SPREAD_MIN", DEFAULT_RISK.halfSpreadMin, 0.000001, 0.5),
  };
  if (risk.maxNetInventory > risk.maxGrossInventory) throw new Error("TEMPO_MAX_NET_INVENTORY cannot exceed TEMPO_MAX_GROSS_INVENTORY");
  if (risk.maxOrderCollateral > risk.firmCapitalCap) throw new Error("TEMPO_MAX_ORDER_COLLATERAL cannot exceed TEMPO_FIRM_CAPITAL_CAP");
  if (risk.halfSpreadMin > risk.halfSpread0) throw new Error("TEMPO_HALF_SPREAD_MIN cannot exceed TEMPO_HALF_SPREAD");
  const assets = text("TEMPO_ASSETS", "BTC,ETH").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!assets.length || assets.length > 20 || assets.some((asset) => !/^[A-Z0-9]{2,12}$/.test(asset))) throw new Error("TEMPO_ASSETS must contain 1-20 comma-separated asset symbols");
  return {
    network,
    endpoints,
    addresses: network === "testnet" ? SOMNIA_TESTNET_ADDRESSES : SOMNIA_MAINNET_ADDRESSES,
    keys: {
      maker: key("TEMPO_KEY_MAKER") ?? key("TEMPO_MAKER_KEY"),
      taker: key("TEMPO_KEY_TAKER") ?? key("TEMPO_TAKER_KEY"),
    },
    risk,
    dryRun: bool("TEMPO_DRY_RUN", true),
    paused: bool("TEMPO_PAUSED", false),
    journalDir: text("TEMPO_JOURNAL_DIR", "journal"),
    assets: [...new Set(assets)],
    venueId: process.env.TEMPO_VENUE_ID?.trim() || undefined,
  };
}
