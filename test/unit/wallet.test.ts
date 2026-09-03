import { describe, expect, it } from "vitest";
import {
  assertAllowedDestinations,
  buildWalletTradeSummary,
  expectedChainId,
  normalizeAddress,
  parseChainId,
  parseReceiptStatus,
  parseTransactionHash,
  readWalletChainId,
  requestAccounts,
  truncateAddress,
} from "@tempo/core";

const ADDRESS = `0x${"a".repeat(40)}` as const;

describe("browser wallet boundary", () => {
  it("accepts only canonical EIP-1193 chain ids and addresses", () => {
    expect(parseChainId("0xc488")).toBe(50312);
    expect(parseChainId(5031)).toBe(5031);
    expect(parseChainId("50312")).toBeUndefined();
    expect(normalizeAddress(ADDRESS)).toBe(ADDRESS);
    expect(normalizeAddress("not-an-address")).toBeUndefined();
  });

  it("keeps network expectations explicit and addresses truncated", () => {
    expect(expectedChainId("testnet")).toBe(50312);
    expect(expectedChainId("mainnet")).toBe(5031);
    expect(truncateAddress(ADDRESS)).toBe("0xaaaaaa…aaaa");
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
      chainId: 50312,
      destinations: [ADDRESS],
      nativeValue: 0n,
      collateralBalance: 100,
    });
    expect(Object.isFrozen(summary)).toBe(true);
    expect(() => buildWalletTradeSummary({ ...summary, secondsLeft: 0 })).toThrow(/expired/);
    expect(() => buildWalletTradeSummary({ ...summary, collateralBalance: 0.1 })).toThrow(/insufficient/);
  });

  it("rejects invalid destinations, hashes, and receipt states", () => {
    expect(assertAllowedDestinations([{ to: ADDRESS }], [ADDRESS])).toEqual([ADDRESS]);
    expect(() => assertAllowedDestinations([{ to: `0x${"b".repeat(40)}` }], [ADDRESS])).toThrow(/allowlisted/);
    expect(parseTransactionHash(`0x${"1".repeat(64)}`)).toBe(`0x${"1".repeat(64)}`);
    expect(parseTransactionHash("0x1234")).toBeUndefined();
    expect(parseReceiptStatus({ status: "0x1" })).toBe("success");
    expect(parseReceiptStatus({ status: "0x0" })).toBe("reverted");
    expect(parseReceiptStatus({ status: "wat" })).toBeUndefined();
  });

  it("strictly rejects malformed account and chain provider responses", async () => {
    await expect(requestAccounts({ request: async () => [ADDRESS, "bad"] })).rejects.toThrow(/malformed/);
    await expect(requestAccounts({ request: async () => [] })).rejects.toThrow(/no accounts/);
    await expect(readWalletChainId({ request: async () => "50312" })).rejects.toThrow(/malformed/);
    await expect(readWalletChainId({ request: async () => "0xc488" })).resolves.toBe(50312);
  });
});
