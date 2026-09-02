import { SomniaMarkets, isBinaryMarket, SOMNIA_TESTNET_ADDRESSES, SOMNIA_TESTNET_PRICE_FEED } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const exchange = new SomniaMarkets({
  indexerUrl: process.env.TEMPO_INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  addresses: SOMNIA_TESTNET_ADDRESSES,
  priceFeed: SOMNIA_TESTNET_PRICE_FEED,
});
const markets = Object.values(await exchange.loadMarkets(true));
console.log("unified markets:", markets.length);
for (const m of markets.slice(0, 20)) {
  if (!m.active || !isBinaryMarket(m.info)) continue;
  const info = m.info as any;
  console.log(JSON.stringify({
    symbol: m.symbol, active: m.active,
    marketId: info.marketId, asset: info.asset, intervalSec: info.intervalSec,
    expiry: info.expiry, venueId: info.venueId,
    outcomes: m.outcomes?.map((o) => o.symbol),
  }));
}
await exchange.close();
process.exit(0);
