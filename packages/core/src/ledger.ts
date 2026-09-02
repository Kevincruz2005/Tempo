/**
 * AgentLedger — a per-agent account of what actually happened, derived only
 * from real fills, real balances, and real settlements. Marks are labeled as
 * derived; nothing here estimates a fake number.
 */
import type { TakerFill } from "./exchange.js";

export interface PositionState {
  /** Contracts held (signed, in outcome terms: + UP / − DOWN represented as UP-equivalent). */
  qtyUp: number;
  qtyDown: number;
  /** Average entry cost per contract (collateral units). */
  costUp: number;
  costDown: number;
}

export interface LedgerSnapshot {
  positions: Record<string, PositionState>;
  /** Collateral spent on buys minus received on sells/claims (human units). */
  netCashOut: number;
  fillCount: number;
}

export class AgentLedger {
  private positions: Record<string, PositionState> = {};
  private netCashOut = 0;
  private fills = 0;

  applyFill(marketId: string, fill: { kind: "BUY_UP" | "BUY_DOWN" | "SELL_UP" | "SELL_DOWN"; price: number; size: number }): void {
    const pos = (this.positions[marketId] ??= { qtyUp: 0, qtyDown: 0, costUp: 0, costDown: 0 });
    this.fills++;
    switch (fill.kind) {
      case "BUY_UP":
        pos.costUp = (pos.costUp * pos.qtyUp + fill.price * fill.size) / (pos.qtyUp + fill.size);
        pos.qtyUp += fill.size;
        this.netCashOut += fill.price * fill.size;
        break;
      case "BUY_DOWN":
        pos.costDown = (pos.costDown * pos.qtyDown + fill.price * fill.size) / (pos.qtyDown + fill.size);
        pos.qtyDown += fill.size;
        this.netCashOut += fill.price * fill.size;
        break;
      case "SELL_UP":
        pos.qtyUp = Math.max(0, pos.qtyUp - fill.size);
        this.netCashOut -= fill.price * fill.size;
        break;
      case "SELL_DOWN":
        pos.qtyDown = Math.max(0, pos.qtyDown - fill.size);
        this.netCashOut -= fill.price * fill.size;
        break;
    }
  }

  /** Realized at settlement: winners pay 1/contract, losers 0 (void: 0.5 both). */
  settle(marketId: string, outcome: "UP_WON" | "DOWN_WON" | "VOID"): number {
    const pos = this.positions[marketId];
    if (!pos) return 0;
    const per = outcome === "VOID" ? 0.5 : outcome === "UP_WON" ? (pos.qtyUp > 0 ? 1 : 0) : pos.qtyDown > 0 ? 1 : 0;
    const winnerQty = outcome === "DOWN_WON" ? pos.qtyDown : pos.qtyUp;
    const winnerCost = outcome === "DOWN_WON" ? pos.costDown : pos.costUp;
    const realized = outcome === "VOID" ? (pos.qtyUp + pos.qtyDown) * 0.5 - (pos.costUp * pos.qtyUp + pos.costDown * pos.qtyDown) : winnerQty * per - winnerCost * winnerQty;
    this.netCashOut -= winnerQty * per;
    delete this.positions[marketId];
    return realized;
  }

  snapshot(): LedgerSnapshot {
    return {
      positions: structuredClone(this.positions),
      netCashOut: this.netCashOut,
      fillCount: this.fills,
    };
  }
}

/** Reduce raw trade rows to ledger fill kinds where sides are known. */
export function fillKindFromTrade(t: { side?: string | undefined }): { kind: "BUY_UP" | "SELL_UP" } | null {
  if (!t.side) return null;
  return t.side === "sell" ? { kind: "SELL_UP" } : { kind: "BUY_UP" };
}
