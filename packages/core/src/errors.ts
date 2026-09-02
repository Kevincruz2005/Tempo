/** Typed error codes — every failure TEMPO can produce is named and testable. */
export type TempoErrorCode =
  | "NO_KEY"
  | "CONFIG_INVALID"
  | "CHAIN_UNAVAILABLE"
  | "INDEXER_UNAVAILABLE"
  | "FEED_UNAVAILABLE"
  | "MARKET_NOT_TRADING"
  | "MARKET_EXPIRED"
  | "NO_OPENING_PRICE"
  | "BELOW_ONE_LOT"
  | "PRICE_OFF_GRID"
  | "RISK_REJECTED"
  | "ORDER_UNFILLED"
  | "REVERTED"
  | "UNAVAILABLE";

export class TempoError extends Error {
  constructor(
    public readonly code: TempoErrorCode,
    message: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TempoError";
  }
}

export function isTempoError(e: unknown): e is TempoError {
  return e instanceof TempoError;
}
