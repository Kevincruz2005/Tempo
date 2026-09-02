import { describe, expect, it } from "vitest";
import {
  fairValue,
  lotsToSize,
  probToTicks,
  sizeToLots,
  ticksToProb,
} from "@tempo/core";

const CASE_COUNT = 2_048;
const cases = Array.from({ length: CASE_COUNT }, (_, id) => {
  const decimals = id % 2 === 0 ? 6 : 18;
  const grid = decimals === 6 ? 1_000n : 1_000_000_000_000_000n;
  const probability = ((id * 7_919 + 104_729) % 999_998 + 1) / 1_000_000;
  const size = ((id * 104_723 + 17) % 2_000_000 + 1) / 10_000;
  const logDistance = (((id * 37) % 401) - 200) / 10_000;
  const sigma = 0.000_005 + ((id * 29) % 200) / 10_000_000;
  const secondsLeft = 1 + ((id * 97) % 14_400);
  return { id, decimals, grid, probability, size, logDistance, sigma, secondsLeft };
});

describe("2,048-case deterministic economic invariant matrix", () => {
  it.each(cases)(
    "case $id preserves quantization and fair-value invariants at $decimals decimals",
    ({ decimals, grid, probability, size, logDistance, sigma, secondsLeft }) => {
      const rawPrice = probToTicks(probability, grid, decimals);
      const rawSize = sizeToLots(size, grid, decimals);
      const quantizedPrice = ticksToProb(rawPrice, decimals);
      const quantizedSize = lotsToSize(rawSize, decimals);
      const humanGrid = Number(grid) / 10 ** decimals;

      expect(rawPrice % grid).toBe(0n);
      expect(rawSize % grid).toBe(0n);
      expect(quantizedPrice).toBeLessThanOrEqual(probability);
      expect(probability - quantizedPrice).toBeLessThan(humanGrid + Number.EPSILON);
      expect(quantizedSize).toBeLessThanOrEqual(size);
      expect(size - quantizedSize).toBeLessThan(humanGrid + Number.EPSILON * Math.max(1, size));
      expect(probToTicks(quantizedPrice, grid, decimals)).toBe(rawPrice);
      expect(sizeToLots(quantizedSize, grid, decimals)).toBe(rawSize);

      const strike = 50_000;
      const above = fairValue({
        spot: strike * Math.exp(logDistance),
        strike,
        sigmaPerSqrtSec: sigma,
        secondsLeft,
      });
      const below = fairValue({
        spot: strike * Math.exp(-logDistance),
        strike,
        sigmaPerSqrtSec: sigma,
        secondsLeft,
      });

      expect(above.p).toBeGreaterThanOrEqual(0);
      expect(above.p).toBeLessThanOrEqual(1);
      expect(above.band[0]).toBeGreaterThanOrEqual(0);
      expect(above.band[0]).toBeLessThanOrEqual(above.band[1]);
      expect(above.band[1]).toBeLessThanOrEqual(1);
      expect(above.expectedMove).toBeGreaterThan(0);
      expect(above.p + below.p).toBeCloseTo(1, 6);
    },
  );
});
