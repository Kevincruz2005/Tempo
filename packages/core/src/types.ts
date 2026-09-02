/** Shared public contracts for @tempo/core. */
export type { Provenance, ProvenanceSource, Tagged } from "./provenance.js";
export type { JournalRecord, JournalType } from "./journal.js";
export type { RiskConfig, TempoConfig } from "./config.js";
export type { QuotePlan, TakerPlan, Book, BookLevel, MarketMeta } from "./policies.js";

export type MarketLifecycle =
  | "BIRTH"
  | "ANCHOR"
  | "GENESIS"
  | "REPRICE"
  | "ENDGAME"
  | "LOCK"
  | "SETTLE"
  | "CLAIM"
  | "ROLL";

export interface MarketSnapshot {
  marketId: string;
  symbol: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  status: number;
  lifecycle: MarketLifecycle;
  openingPrice?: number;
  spot?: number;
  fairValueEstimate?: number;
  secondsLeft: number;
}

export interface TransactionEvidence {
  hash: `0x${string}`;
  status: "success";
  block?: bigint;
}
