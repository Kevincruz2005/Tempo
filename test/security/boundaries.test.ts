import { describe, expect, it } from "vitest";
import { clampProbToTicks, probToTicks, sizeToLots } from "@tempo/core";

describe("security boundaries", () => {
  it("rejects malformed probability and size inputs", () => {
    expect(() => probToTicks(1.1, 1000n, 6)).toThrow(/outside/);
    expect(() => sizeToLots(-1, 1000n, 6)).toThrow(/invalid/);
  });

  it("keeps binary prices strictly inside the book", () => {
    expect(clampProbToTicks(0, 1000n, 6).ticks).toBe(1000n);
    expect(clampProbToTicks(1, 1000n, 6).ticks).toBe(999000n);
  });
});
