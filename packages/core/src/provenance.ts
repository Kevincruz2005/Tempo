/**
 * Provenance — every displayed value carries where it came from. The UI and
 * `tempo verify` render these tags verbatim; if a value has no provenance it
 * is not displayed.
 */
import type { TempoConfig } from "./config.js";

export type ProvenanceSource =
  | "price-feed"
  | "indexer"
  | "on-chain"
  | "policy"
  | "journal"
  | "derived";

export interface Provenance {
  source: ProvenanceSource;
  /** Endpoint URL, contract address, or policy name. */
  via: string;
  /** Chain block number when the value was read. */
  block?: number;
  /** ISO timestamp of the read. */
  at: string;
}

export function tag(source: ProvenanceSource, via: string, block?: number): Provenance {
  return { source, via, block, at: new Date().toISOString() };
}

/** Wrap a value with its provenance for transport to the UI. */
export interface Tagged<T> {
  value: T;
  prov: Provenance;
}

export function tagged<T>(value: T, prov: Provenance): Tagged<T> {
  return { value, prov };
}

export function describeConfig(cfg: TempoConfig): Record<string, string> {
  return {
    network: cfg.network,
    indexer: cfg.endpoints.indexerUrl,
    rpc: cfg.endpoints.rpcUrl,
    wsRpc: cfg.endpoints.wsRpcUrl,
    priceFeed: cfg.endpoints.priceFeed?.url ?? "UNAVAILABLE (mainnet: set PRICE_FEED_URL)",
    collateral: cfg.addresses.collateral ?? "UNAVAILABLE",
    binaryModule: cfg.addresses.binaryModule ?? "UNAVAILABLE",
  };
}
