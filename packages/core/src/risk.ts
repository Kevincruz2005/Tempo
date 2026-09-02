/**
 * RiskEngine — every plan (maker quote, taker order, manual trade) passes
 * through here before execution. Rejections are typed and journaled; nothing
 * reaches the SDK unsigned and unsanctioned.
 */
import type { RiskConfig } from "./config.js";

export interface RiskCheckOrder {
  /** Side being bought in outcome terms: "UP" or "DOWN". */
  outcome: "UP" | "DOWN";
  /** Probability (Up terms) at which the order rests/takes. */
  price: number;
  /** Contracts (human units, lot-quantized). */
  size: number;
  /** Collateral committed if fully filled (price × size). */
  collateral: number;
  /** Seconds until this order expires (or the window closes, whichever first). */
  secondsLeft: number;
  /** Cadence of the series in seconds (for scaled gates). */
  intervalSec: number;
}

export interface RiskState {
  /** Current net inventory in contracts (+ long Up, − long Down). */
  netInventory: number;
  /** Current gross inventory (|up| + |down|). */
  grossInventory: number;
  /** Collateral already committed in open orders + inventory cost basis. */
  capitalCommitted: number;
  /** Current working order count for this market window. */
  openOrders?: number;
  /** Realized P&L for this market window; losses are negative. */
  realizedPnl?: number;
}

export type RiskVerdict = { ok: true } | { ok: false; reason: string; code: string };

export class RiskEngine {
  constructor(private readonly cfg: RiskConfig) {}

  /** Min seconds-left before the maker stops quoting, scaled to the cadence. */
  minLeftMaker(intervalSec: number): number {
    return this.cfg.minLeftSecMaker > 0
      ? this.cfg.minLeftSecMaker
      : Math.max(20, Math.floor(intervalSec * 0.1));
  }

  minLeftTaker(): number {
    return this.cfg.minLeftSecTaker;
  }

  check(order: RiskCheckOrder, state: RiskState): RiskVerdict {
    const { price, size, collateral, secondsLeft, intervalSec } = order;
    if (!(price > 0 && price < 1)) {
      return { ok: false, reason: `price ${price} outside (0,1)`, code: "PRICE_OFF_GRID" };
    }
    if (!(size > 0)) {
      return { ok: false, reason: `size ${size} below one lot`, code: "BELOW_ONE_LOT" };
    }
    if (collateral > this.cfg.maxOrderCollateral) {
      return {
        ok: false,
        reason: `order collateral ${collateral.toFixed(2)} exceeds per-order cap ${this.cfg.maxOrderCollateral}`,
        code: "RISK_REJECTED",
      };
    }
    const newGross = state.grossInventory + size;
    if (newGross > this.cfg.maxGrossInventory) {
      return {
        ok: false,
        reason: `gross inventory ${state.grossInventory}+${size} would exceed cap ${this.cfg.maxGrossInventory}`,
        code: "RISK_REJECTED",
      };
    }
    const signedDelta = order.outcome === "UP" ? size : -size;
    const newNet = state.netInventory + signedDelta;
    if (Math.abs(newNet) > this.cfg.maxNetInventory) {
      return {
        ok: false,
        reason: `net inventory ${state.netInventory}→${newNet} would exceed cap ±${this.cfg.maxNetInventory}`,
        code: "RISK_REJECTED",
      };
    }
    if (state.capitalCommitted + collateral > this.cfg.firmCapitalCap) {
      return {
        ok: false,
        reason: `firm capital ${state.capitalCommitted.toFixed(2)}+${collateral.toFixed(2)} would exceed cap ${this.cfg.firmCapitalCap}`,
        code: "RISK_REJECTED",
      };
    }
    if ((state.openOrders ?? 0) + 1 > this.cfg.maxOpenOrdersPerWindow) {
      return {
        ok: false,
        reason: `open orders ${(state.openOrders ?? 0) + 1} would exceed window cap ${this.cfg.maxOpenOrdersPerWindow}`,
        code: "RISK_REJECTED",
      };
    }
    if ((state.realizedPnl ?? 0) <= -this.cfg.maxLossPerWindow) {
      return {
        ok: false,
        reason: `window loss ${state.realizedPnl ?? 0} reached cap -${this.cfg.maxLossPerWindow}`,
        code: "RISK_REJECTED",
      };
    }
    const minLeft = this.minLeftMaker(intervalSec);
    if (secondsLeft < minLeft) {
      return {
        ok: false,
        reason: `window too close to close (${secondsLeft.toFixed(0)}s < ${minLeft}s)`,
        code: "MARKET_EXPIRED",
      };
    }
    return { ok: true };
  }

  /** Taker-specific gate: needs edge over fair value AND time headroom. */
  checkTaker(
    order: RiskCheckOrder & { fairValue: number; edge: number },
    state: RiskState,
  ): RiskVerdict {
    const base = this.check(order, state);
    if (!base.ok) return base;
    const minLeft = this.minLeftTaker();
    if (order.secondsLeft < minLeft) {
      return {
        ok: false,
        reason: `taker gate: ${order.secondsLeft.toFixed(0)}s left < ${minLeft}s`,
        code: "MARKET_EXPIRED",
      };
    }
    const deviation = order.outcome === "UP" ? order.fairValue - order.price : 1 - order.fairValue - order.price;
    if (deviation < order.edge) {
      return {
        ok: false,
        reason: `edge ${(deviation * 100).toFixed(1)}% < threshold ${(order.edge * 100).toFixed(1)}%`,
        code: "RISK_REJECTED",
      };
    }
    return { ok: true };
  }
}
