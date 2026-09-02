import { describe, expect, it } from "vitest";
import { fairValue, realizedVolPerSqrtSec } from "@tempo/core";

describe("fair value estimate", () => {
  it("is neutral at spot equal to strike", () => {
    const result = fairValue({ spot: 100, strike: 100, sigmaPerSqrtSec: 0.001, secondsLeft: 60 });
    expect(result.p).toBeCloseTo(0.5, 6);
    expect(result.band[0]).toBeLessThan(result.p);
    expect(result.band[1]).toBeGreaterThan(result.p);
  });

  it("converges to the determined outcome at expiry", () => {
    expect(fairValue({ spot: 101, strike: 100, sigmaPerSqrtSec: 0.001, secondsLeft: 0 }).p).toBe(1);
    expect(fairValue({ spot: 99, strike: 100, sigmaPerSqrtSec: 0.001, secondsLeft: 0 }).p).toBe(0);
  });

  it("derives volatility from timestamped observations", () => {
    const sigma = realizedVolPerSqrtSec([
      { price: 100, ts: 0 },
      { price: 101, ts: 1000 },
      { price: 100, ts: 2000 },
      { price: 102, ts: 3000 },
    ]);
    expect(sigma).toBeGreaterThan(0);
  });

  it("is honestly unavailable without observed volatility", () => {
    expect(Number.isNaN(fairValue({ spot: 100, strike: 100, sigmaPerSqrtSec: NaN, secondsLeft: 60 }).p)).toBe(true);
  });
});
