import { describe, expect, it } from "vitest";
import { generatePrivateKey } from "viem/accounts";
import { TempoError, TempoExchange, loadConfig } from "@tempo/core";

describe("live chain gate", () => {
  it("rejects a non-trading indexer row before any send", async () => {
    const exchange = new TempoExchange({ config: loadConfig(), privateKey: generatePrivateKey() });
    try {
      const live = await exchange.sdk.client.listLiveBinaryMarkets({ limit: 50 });
      let locked: (typeof live)[number] | undefined;
      for (const row of live) {
        if ((await exchange.onchain(row.marketId)).status !== 1) {
          locked = row;
          break;
        }
      }
      if (!locked) return;
      await expect(exchange.mintSet(locked.marketId, 0.001)).rejects.toMatchObject<Partial<TempoError>>({ code: "MARKET_NOT_TRADING" });
    } finally {
      await exchange.close();
    }
  }, 40_000);
});
