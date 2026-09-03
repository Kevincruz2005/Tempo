import { describe, expect, it } from "vitest";
import { buildWalletTradeSummary, expectedChainId, normalizeAddress, parseChainId, truncateAddress } from "@tempo/core";

describe("browser wallet boundary", () => {
  it("accepts only canonical EIP-1193 chain ids and addresses", () => {
    expect(parseChainId("0xc488")).toBe(50312);
    expect(parseChainId(5031)).toBe(5031);
    expect(parseChainId("50312")).toBeUndefined();
    expect(normalizeAddress(`0x${"a".repeat(40)}`)).toBe(`0x${"a".repeat(40)}`);
    expect(normalizeAddress("not-an-address")).toBeUndefined();
  });

  it("keeps network expectations explicit and addresses truncated", () => {
    expect(expectedChainId("testnet")).toBe(50312);
    expect(expectedChainId("mainnet")).toBe(5031);
    expect(truncateAddress(`0x${"a".repeat(40)}`)).toBe("0xaaaaaa…aaaa");
    expect(truncateAddress(undefined)).toBe("UNAVAILABLE");
  });

  it("requires a complete pre-sign summary", () => {
    const summary = buildWalletTradeSummary({
      marketSymbol: "BTC-TEST/tUSDC",
      side: "UP",
      size: 1,
      limitPrice: 0.5,
      expireTimestampNs: 1_000_000_000n,
      secondsLeft: 30,
      worstCaseCost: 0.5,
    });
    expect(Object.isFrozen(summary)).toBe(true);
    expect(() => buildWalletTradeSummary({ ...summary, secondsLeft: 0 })).toThrow(/expired/);
  });
});

