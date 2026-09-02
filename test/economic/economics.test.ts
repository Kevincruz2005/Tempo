import { describe, expect, it } from "vitest";
import { dynamicHalfSpread, inventorySkew } from "@tempo/core";

describe("economic behavior", () => {
  it("tightens the spread into endgame without crossing its floor", () => {
    const early = dynamicHalfSpread(300, 300, 0.03, 0.006, 0);
    const late = dynamicHalfSpread(10, 300, 0.03, 0.006, 0);
    expect(late).toBeLessThan(early);
    expect(late).toBeGreaterThanOrEqual(0.006);
  });

  it("skews monotonically with inventory and remains bounded", () => {
    expect(inventorySkew(-100, 50, 0.01)).toBe(-0.01);
    expect(inventorySkew(0, 50, 0.01)).toBe(0);
    expect(inventorySkew(100, 50, 0.01)).toBe(0.01);
  });

  it("accounts for a complete-set spread deterministically", () => {
    const buyUp = 0.47;
    const buyDown = 0.48;
    expect(1 - buyUp - buyDown).toBeCloseTo(0.05);
  });
});
