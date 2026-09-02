import { describe, expect, it } from "vitest";
import { TempoExchange, loadConfig } from "@tempo/core";

describe("live indexer + chain + feed integration", () => {
  it("joins one live market to chain, opening boundary, book, and feed", async () => {
    const exchange = new TempoExchange({ config: loadConfig() });
    try {
      const rows = await exchange.markets({ maxAgeMs: 0 });
      const market = rows.find((row) => row.expiry > Date.now() / 1000 + 30) ?? rows[0];
      const onchain = await exchange.onchain(market.marketId);
      const spot = await exchange.spot(market.asset);
      const [opening, book] = await Promise.all([
        exchange.openingPrice(market.marketId, spot?.price),
        exchange.book(market.upSymbol, 3),
      ]);
      expect(onchain.pool).toMatch(/^0x[0-9a-f]{40}$/i);
      expect(spot?.price).toBeGreaterThan(0);
      expect(opening === undefined || opening > 0).toBe(true);
      expect(Array.isArray(book.bids) && Array.isArray(book.asks)).toBe(true);
    } finally {
      await exchange.close();
    }
  }, 120_000);
});
