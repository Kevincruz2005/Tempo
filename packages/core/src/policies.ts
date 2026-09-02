/**
 * Agent policies — pure functions from real inputs to plans. No I/O, no time
 * reads, no randomness: the same inputs always produce the same plan, which is
 * what makes the unit tests and the journal replay meaningful.
 *
 * GENESIS (maker): anchor a two-sided quote at window birth and keep it fresh.
 *   Two-sided with zero inventory = Buy Up at (p − δ) + Buy Down at ((1−p) − δ)
 *   — the mint-a-pair cold-start the venue itself was designed around. When
 *   holding Up inventory, the ask side is served by Sell Up instead of Buy Down
 *   (you can only sell what you hold).
 * VECTOR (taker): take liquidity when the touch deviates from its own fair
 *   value beyond its edge threshold; otherwise stand down. Different vol
 *   window, different edge, different risk appetite — so it genuinely
 *   disagrees with GENESIS on the same book.
 */
import type { FairValue } from "./fairValue.js";

export interface BookLevel {
  price: number;
  size: number;
}

export interface Book {
  yesBids: BookLevel[];
  yesAsks: BookLevel[];
  noBids: BookLevel[];
  noAsks: BookLevel[];
}

export interface MarketMeta {
  marketId: string;
  symbol: string;
  asset: string;
  intervalSec: number;
  /** Unix seconds when the window closes. */
  expiry: number;
  venueId?: string;
}

export interface QuotePlanOrder {
  kind: "BUY_UP" | "BUY_DOWN" | "SELL_UP" | "SELL_DOWN";
  price: number;
  size: number;
}

export interface QuotePlanCancel {
  id: string;
  symbol: string;
}

export interface QuotePlan {
  /** Working orders to cancel first — cancel-then-replace per order. */
  cancels: QuotePlanCancel[];
  orders: QuotePlanOrder[];
  /** The Up-probability mid the quotes were anchored to (for the journal). */
  anchorBid: number;
  anchorAsk: number;
}

export interface MakerInputs {
  meta: MarketMeta;
  book: Book;
  fv: FairValue;
  /** Signed net inventory in contracts: + long Up, − long Down. */
  netInventory: number;
    /** Own working orders (id, side, price, size, symbol) — cancel + de-dupe input. */
  openOrders: Array<{
    id: string;
    side: "BUY_UP" | "BUY_DOWN" | "SELL_UP" | "SELL_DOWN";
    price: number;
    size: number;
    symbol: string;
  }>;
  now: number;
  tick: number;
  lot: number;
  halfSpread: number;
  quoteSize: number;
  /** Min seconds left before quoting stops (risk gate applied by RiskEngine too). */
  minLeftSec: number;
}

/** Half-spread tightens as the window ages: δ = δ0·√(t/t0), floored at δmin. */
export function dynamicHalfSpread(
  secondsLeft: number,
  intervalSec: number,
  halfSpread0: number,
  halfSpreadMin: number,
  nearCertainty: number,
): number {
  const t0 = Math.max(1, intervalSec);
  const t = Math.max(0, secondsLeft);
  const base = Math.max(halfSpreadMin, halfSpread0 * Math.sqrt(t / t0));
  // Near certainty (|d| large), widen slightly: being wrong is maximally costly.
  const widening = 1 + Math.min(1.5, Math.max(0, Math.abs(nearCertainty) - 2) * 0.25);
  return base * widening;
}

/** Inventory skew: bias the quote mid to shed inventory (probability units). */
export function inventorySkew(netInventory: number, maxInventory: number, baseSkew: number): number {
  if (maxInventory <= 0) return 0;
  const frac = Math.max(-1, Math.min(1, netInventory / maxInventory));
  // Long Up (+) → skew the Up mid UP (ask higher, bid higher) to sell into strength.
  return baseSkew * frac;
}

export function genesisQuotePlan(input: MakerInputs): QuotePlan | null {
  const { meta, fv, netInventory, openOrders, now, tick, lot, quoteSize, minLeftSec } = input;
  const secondsLeft = meta.expiry - now;
  if (secondsLeft < minLeftSec) return null;
  if (!Number.isFinite(fv.p)) return null;

  const δ = dynamicHalfSpread(secondsLeft, meta.intervalSec, input.halfSpread, Math.max(tick, 0.002), fv.d);
  const skew = inventorySkew(netInventory, Math.max(1, quoteSize * 2), Math.max(tick, 0.004));

  // Round to the tick grid, inward from the boundaries.
  const snap = (p: number) => Math.max(tick, Math.min(1 - tick, Math.round(p / tick) * tick));
  const anchorMid = Math.max(tick, Math.min(1 - tick, fv.p + skew));
  const bidUp = snap(anchorMid - δ);
  const askUp = snap(anchorMid + δ);
  if (askUp <= bidUp) return null;

  const size = Math.max(lot, Math.floor(quoteSize / lot) * lot);
  if (size <= 0) return null;

  const orders: QuotePlanOrder[] = [{ kind: "BUY_UP", price: bidUp, size }];
  // Ask side: sell held Up inventory when we have it; otherwise Buy Down
  // (mint-a-pair) at 1 − askUp.
  const holdUp = netInventory > 0;
  const askOrder: QuotePlanOrder = holdUp
    ? { kind: "SELL_UP", price: askUp, size: Math.min(size, Math.floor(netInventory / lot) * lot) }
    : { kind: "BUY_DOWN", price: snap(1 - askUp), size };
  if (askOrder.size > 0) orders.push(askOrder);

  // Don't churn: if identical orders already rest, keep them.
  const stillResting = (o: QuotePlanOrder) =>
    openOrders.some((w) => w.side === o.kind && Math.abs(w.price - o.price) < tick / 2 && w.size >= o.size);
  const fresh = orders.filter((o) => !stillResting(o));
  const keepIds = new Set(
    openOrders
      .filter((w) => fresh.some((o) => o.kind === w.side && Math.abs(o.price - w.price) < tick / 2 && o.size <= w.size))
      .map((w) => w.id),
  );
  const cancels = openOrders.map((w) => ({ id: w.id, symbol: w.symbol })).filter((c) => !keepIds.has(c.id));
  if (fresh.length === 0 && cancels.length === 0) return null;
  if (fresh.length === 0) return { cancels, orders: [], anchorBid: bidUp, anchorAsk: askUp };

  return { cancels, orders: fresh, anchorBid: bidUp, anchorAsk: askUp };
}

// ---------------------------------------------------------------------------
// Taker (VECTOR)
// ---------------------------------------------------------------------------

export interface TakerInputs {
  meta: MarketMeta;
  book: Book;
  fv: FairValue;
  now: number;
  tick: number;
  lot: number;
  edge: number;
  size: number;
  minLeftSec: number;
  /** Max collateral this taker will commit to one order. */
  maxCollateral: number;
}

export interface TakerPlan {
  kind: "BUY_UP" | "BUY_DOWN";
  price: number;
  size: number;
  /** The deviation that triggered the take (probability units). */
  edgeObserved: number;
  reason: string;
}

export function takerPlan(input: TakerInputs): TakerPlan | null {
  const { meta, book, fv, now, tick, lot, edge, size, minLeftSec, maxCollateral } = input;
  const secondsLeft = meta.expiry - now;
  if (secondsLeft < minLeftSec) return null;
  if (!Number.isFinite(fv.p)) return null;

  const bestAsk = book.yesAsks[0]?.price;
  const bestBid = book.yesBids[0]?.price;

  // Cheap Up: the ask is below our fair value by more than the edge.
  if (bestAsk !== undefined && fv.p - bestAsk >= edge) {
    const takeable = book.yesAsks[0].size;
    const byCollateral = maxCollateral / Math.max(bestAsk, tick);
    const planned = Math.min(size, takeable, Math.floor(byCollateral / lot) * lot);
    if (planned >= lot) {
      return {
        kind: "BUY_UP",
        price: bestAsk,
        size: planned,
        edgeObserved: fv.p - bestAsk,
        reason: `ask ${bestAsk.toFixed(3)} ≤ fair ${fv.p.toFixed(3)} − edge ${edge.toFixed(3)}`,
      };
    }
  }
  // Rich Up bid ⇒ cheap Down: buying Down at 1 − bid.
  if (bestBid !== undefined && bestBid - fv.p >= edge) {
    const downPrice = Math.max(tick, Math.min(1 - tick, 1 - bestBid));
    const noAsk = book.noAsks[0];
    const takeable = noAsk ? noAsk.size : size;
    const byCollateral = maxCollateral / Math.max(downPrice, tick);
    const planned = Math.min(size, takeable, Math.floor(byCollateral / lot) * lot);
    if (planned >= lot) {
      return {
        kind: "BUY_DOWN",
        price: downPrice,
        size: planned,
        edgeObserved: bestBid - fv.p,
        reason: `bid ${bestBid.toFixed(3)} ≥ fair ${fv.p.toFixed(3)} + edge ${edge.toFixed(3)}`,
      };
    }
  }
  return null;
}

/** Public SDK facade over the deterministic maker function. */
export class GenesisMaker {
  quotePlan(input: MakerInputs): QuotePlan | null {
    return genesisQuotePlan(input);
  }
}

/** Public SDK facade over the deterministic taker function. */
export class TakerPolicy {
  takerPlan(input: TakerInputs): TakerPlan | null {
    return takerPlan(input);
  }
}
