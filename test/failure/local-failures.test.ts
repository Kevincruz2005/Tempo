import { describe, expect, it } from "vitest";
import { DEFAULT_RISK, RiskEngine, TempoError, fairValue, genesisQuotePlan } from "@tempo/core";

describe("failure paths without network substitution", () => {
  it("rejects an underfunded plan locally", () => {
    const verdict = new RiskEngine({ ...DEFAULT_RISK, firmCapitalCap: 1 }).check(
      { outcome: "UP", price: 0.5, size: 5, collateral: 2.5, secondsLeft: 100, intervalSec: 300 },
      { netInventory: 0, grossInventory: 0, capitalCommitted: 0 },
    );
    expect(verdict.ok).toBe(false);
  });

  it("does not quote an expired window", () => {
    const plan = genesisQuotePlan({
      meta: { marketId: "math-fixture", symbol: "fixture", asset: "BTC", intervalSec: 60, expiry: 10 },
      book: { yesBids: [], yesAsks: [], noBids: [], noAsks: [] },
      fv: fairValue({ spot: 100, strike: 100, sigmaPerSqrtSec: 0.001, secondsLeft: 0 }),
      netInventory: 0,
      openOrders: [],
      now: 11,
      tick: 0.001,
      lot: 0.001,
      halfSpread: 0.03,
      quoteSize: 1,
      minLeftSec: 1,
    });
    expect(plan).toBeNull();
  });

  it("preserves typed protocol failures", () => {
    expect(new TempoError("REVERTED", "PostOnlyWouldCross").code).toBe("REVERTED");
  });
});
