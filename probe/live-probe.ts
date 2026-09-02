// Read-only live probe against the Somnia Shannon testnet DreamDEX deployment.
// Verifies: indexer reachability, live binary markets, on-chain status, book
// params, order book, opening prices, price feed. No keys, no writes.
import {
  SomniaMarkets,
  isBinaryMarket,
  SOMNIA_TESTNET_PRICE_FEED,
  SOMNIA_TESTNET_ADDRESSES,
} from "@somnia-chain/markets-sdk";
import { defineChain } from "viem";

const indexerUrl = process.env.INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql";
const rpcUrl = process.env.RPC_URL ?? "https://api.infra.testnet.somnia.network";
const wsRpcUrl = process.env.WS_RPC_URL ?? "wss://api.infra.testnet.somnia.network/ws";

const chain = defineChain({
  id: 50312,
  name: "Somnia Shannon",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

const exchange = new SomniaMarkets({
  indexerUrl,
  chain,
  wsRpcUrl,
  addresses: SOMNIA_TESTNET_ADDRESSES,
  priceFeed: SOMNIA_TESTNET_PRICE_FEED,
});

const now = Date.now() / 1000;
console.log("== listing live binary markets ==");
const live = await exchange.client.listLiveBinaryMarkets({ limit: 50 });
console.log("live rows:", live.length);

const seen = new Map<string, number>();
for (const m of live) {
  const key = `${m.asset}/${Number(m.intervalSec) / 60}m`;
  seen.set(key, (seen.get(key) ?? 0) + 1);
}
console.log("series summary:", [...seen.entries()]);

// pick the first few for deep inspection
let inspected = 0;
for (const m of live) {
  if (inspected >= 3) break;
  const marketId = m.marketId as `0x${string}`;
  const onchain = await exchange.client.getMarketOnchain(marketId);
  const sLeft = Number(m.expiry) - now;
  console.log("\n-- market", m.symbol ?? marketId);
  console.log("   asset:", m.asset, "cadence:", Number(m.intervalSec) / 60 + "m", "secondsLeft:", Math.round(sLeft));
  console.log("   onchain status:", onchain.status, "(1=Trading) pool:", onchain.pool);
  console.log("   venueId:", m.venueId);
  console.log("   outcomes:", m.outcomes?.map((o) => o.symbol));
  try {
    const params = await exchange.client.getBinaryBookParams(onchain.pool);
    console.log("   book params:", {
      tickSize: params.tickSize.toString(),
      lotSize: params.lotSize.toString(),
      minQuantity: params.minQuantity?.toString(),
    });
  } catch (e) {
    console.log("   book params: unavailable:", String(e).slice(0, 120));
  }
  try {
    const up = m.outcomes?.[0]?.symbol;
    if (up) {
      const book = await exchange.fetchOrderBook(up, 3);
      console.log("   book bids:", book.bids.slice(0, 3), "asks:", book.asks.slice(0, 3));
    }
  } catch (e) {
    console.log("   book: unavailable:", String(e).slice(0, 120));
  }
  inspected++;
}

// opening prices for inspected markets
try {
  const ids = live.slice(0, 5).map((m) => m.marketId as `0x${string}`);
  const openings = await exchange.client.getOpeningPrices(ids);
  console.log("\n== opening prices ==");
  for (const [id, v] of Object.entries(openings ?? {})) console.log(id, JSON.stringify(v).slice(0, 200));
} catch (e) {
  console.log("opening prices: unavailable:", String(e).slice(0, 200));
}

// settled history
try {
  const past = await exchange.client.listPastBinaryMarkets({ status: "Finalized", limit: 5 });
  console.log("\n== recently finalized ==", past.length);
  for (const m of past) {
    console.log(
      m.asset,
      Number(m.intervalSec) / 60 + "m",
      "expiry", new Date(Number(m.expiry) * 1000).toISOString(),
      "trades", m.tradeCount?.toString?.() ?? m.tradeCount,
      "vol(quote)", m.cumulativeQuoteVolume?.toString?.()?.slice(0, 12),
      "lastPrice", m.lastPrice?.toString?.()?.slice(0, 10),
    );
  }
} catch (e) {
  console.log("finalized list: unavailable:", String(e).slice(0, 200));
}

// price feed (underlying spot)
try {
  console.log("\n== price feed ==");
  for (const base of ["BTC", "ETH"]) {
    try {
      const px = await (exchange as any).fetchPrice?.(base);
      console.log(base, "spot:", px);
    } catch (e: any) {
      console.log(base, "spot unavailable:", String(e?.message ?? e).slice(0, 120));
    }
  }
} catch (e) {
  console.log("price feed unavailable:", String(e).slice(0, 200));
}

await exchange.close?.().catch(() => {});
console.log("\nPROBE DONE");
process.exit(0);
