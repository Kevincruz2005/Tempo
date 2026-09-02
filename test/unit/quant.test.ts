import { describe, expect, it } from "vitest";
import { lotsToSize, probToTicks, quantizePrice, quantizeSize, sizeToLots, ticksToProb } from "@tempo/core";

describe("decimal-aware quantization", () => {
  it("uses the testnet 6-decimal live grid", () => {
    expect(probToTicks(0.5129, 1000n, 6)).toBe(512000n);
    expect(ticksToProb(512000n, 6)).toBe(0.512);
    expect(sizeToLots(1.2349, 1000n, 6)).toBe(1_234_000n);
    expect(lotsToSize(1_234_000n, 6)).toBe(1.234);
  });

  it("produces the same human grid at 18 decimals", () => {
    expect(quantizePrice(0.5129, 1_000_000_000_000_000n, 18)).toBe(0.512);
    expect(quantizeSize(1.2349, 1_000_000_000_000_000n, 18)).toBe(1.234);
  });
});
