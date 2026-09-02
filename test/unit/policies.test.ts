import { describe, expect, it } from "vitest";
import { GenesisMaker, TakerPolicy, fairValue, type Book, type MarketMeta } from "@tempo/core";

const meta: MarketMeta = { marketId: "fixture-math-only", symbol: "BTC-window", asset: "BTC", intervalSec: 300, expiry: 1_300 };
const emptyBook: Book = { yesBids: [], yesAsks: [], noBids: [], noAsks: [] };
const fv = fairValue({ spot: 101, strike: 100, sigmaPerSqrtSec: 0.001, secondsLeft: 300 });

describe("pure policies", () => {
  it("GENESIS creates a zero-inventory two-sided opening plan", () => {
    const plan = new GenesisMaker().quotePlan({
      meta,
      book: emptyBook,
      fv,
      netInventory: 0,
      openOrders: [],
      now: 1_000,
      tick: 0.001,
      lot: 0.001,
      halfSpread: 0.03,
      quoteSize: 5,
      minLeftSec: 20,
    });
    expect(plan?.orders.map((entry) => entry.kind)).toEqual(["BUY_UP", "BUY_DOWN"]);
    expect((plan?.anchorBid ?? 1) < (plan?.anchorAsk ?? 0)).toBe(true);
  });

  it("VECTOR takes a sufficiently cheap UP ask", () => {
    const book: Book = { ...emptyBook, yesAsks: [{ price: 0.2, size: 10 }] };
    const plan = new TakerPolicy().takerPlan({
      meta,
      book,
      fv,
      now: 1_000,
      tick: 0.001,
      lot: 0.001,
      edge: 0.04,
      size: 5,
      minLeftSec: 5,
      maxCollateral: 10,
    });
    expect(plan?.kind).toBe("BUY_UP");
  });
});
