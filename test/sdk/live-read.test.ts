import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TempoExchange, loadConfig } from "@tempo/core";

describe("live @tempo/core read surface", () => {
  const exchange = new TempoExchange({ config: loadConfig() });
  let market: Awaited<ReturnType<TempoExchange["markets"]>>[number];

  beforeAll(async () => {
    const rows = await exchange.markets({ maxAgeMs: 0 });
    market = rows.find((row) => row.expiry > Date.now() / 1000 + 15) ?? rows[0];
  }, 120_000);
  afterAll(() => exchange.close());

  it("loads live windows and chain status", async () => {
    expect(market.marketId).toMatch(/^0x[0-9a-f]{64}$/i);
    expect((await exchange.onchain(market.marketId)).status).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it("reads decimal-derived grids and official spot", async () => {
    const onchain = await exchange.onchain(market.marketId);
    const [params, spot] = await Promise.all([exchange.bookParams(onchain.pool), exchange.spot(market.asset)]);
    expect(params.tickSize).toBeGreaterThan(0n);
    expect(params.lotSize).toBeGreaterThan(0n);
    expect(params.decimals).toBeGreaterThan(0);
    expect(spot?.price).toBeGreaterThan(0);
  }, 60_000);
});
