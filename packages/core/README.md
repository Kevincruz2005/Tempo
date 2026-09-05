# @tempo/core

Typed Node.js SDK for DreamDEX Event Contracts and autonomous opening-auction
systems on Somnia. It wraps the official `@somnia-chain/markets-sdk` `0.29.0`
surface with market-ID-safe reads, decimal-aware execution, settlement and
claim helpers, deterministic policies, risk controls, provenance, and replay.

## Requirements

- Node.js 20 or newer
- ESM
- A Somnia RPC, indexer, and WebSocket connection; official defaults are built
  into `loadConfig()`
- A private key only for intentional writes

## Install from GitHub Releases

```bash
npm install https://github.com/Kevincruz2005/Tempo/releases/download/sdk-v0.3.1/tempo-core-0.3.1.tgz
```

## Read-only example

```ts
import { loadConfig, TempoExchange } from "@tempo/core";

const config = loadConfig();
const exchange = new TempoExchange({ config });

try {
  const markets = await exchange.markets();
  const market = markets[0];
  if (!market) throw new Error("NO DATA");

  const chain = await exchange.onchain(market.marketId);
  const [grid, book, spot, opening] = await Promise.all([
    exchange.bookParams(chain.pool),
    exchange.book(market.upSymbol, 5),
    exchange.spot(market.asset),
    exchange.openingPrice(market.marketId),
  ]);

  console.log({ market, chain, grid, book, spot, opening });
} finally {
  await exchange.close();
}
```

## Signed execution

```ts
const signed = new TempoExchange({
  config,
  privateKey: config.keys.maker,
});

const result = await signed.quote(
  market.marketId,
  "UP",
  25,
  0.48,
  BigInt(Date.now() + 8_000) * 1_000_000n,
);
```

Trading writes re-read live on-chain status, derive tick, lot, and collateral
decimals from the live deployment, enforce explicit order lifetime, and check
the official SDK receipt. Firm plans additionally pass `RiskEngine` before
execution. Omitting the key produces typed `NO_KEY` failures rather than fake
execution.

## External wallet and calibration

Browser integrations pass a viem `WalletClient` backed by an EIP-1193 provider;
no private key is required. Call `buildWalletOrder(address, market, outcome,
size, price)` to obtain SDK unsigned approval/order calls after the same live
status and `RiskEngine` checks used by `place`. The review includes chain,
allowlisted destinations, native value, collateral balance, and decimals;
request a separate human confirmation before signing.

`CalibrationEngine` fits a bounded probability-temperature model to the latest
30 journaled resolved outcomes and scores VECTOR direction against settlement.
It adjusts only bounded `sigmaMultiplier` and `takerEdge` values. It never
changes risk caps or recalibrates the same window; `force` bypasses only the
25-market minimum.

## Public surface

| Module | Capability |
| --- | --- |
| `TempoExchange` | Markets, chain state, books, feed, balances, orders, mint/burn, claims, candles, and real-data backtest |
| `fairValue` | Driftless-diffusion probability estimate from documented real inputs |
| `genesisQuotePlan` | Pure post-only opening-anchor policy |
| `takerPlan` | Pure IOC edge-taking policy |
| `RiskEngine` | Capital, inventory, loss, order-count, time, and edge gates |
| Quantization | 6- and 18-decimal tick/lot conversion using bigint raw units |
| `Journal` | Typed JSONL append, subscribe, tail, since, disk read, and replay |
| `AgentLedger` | Fill-derived positions, cash flow, and settlement |
| Firm reporting | Journal aggregation, Brier scoring, deterministic Markdown, and optional labeled AI narrative |
| Wallet helpers | EIP-6963/EIP-1193 parsing, chain checks, and frozen pre-sign summaries |
| CalibrationEngine | Bounded, journal-scored pricing adjustment with corrupt-state recovery |
| Provenance | Typed source, endpoint/contract, timestamp, and block tags |
| Errors | Named `TempoErrorCode` failures and `isTempoError` guard |

## Data integrity

The SDK does not manufacture economic values. Missing chain, indexer, price
feed, history, or signer state remains unavailable. Fair value and volatility
are estimates and must not be represented as on-chain facts.

## Verification

The release is built from the same source covered by 2,107 offline tests,
including 2,048 decimal/economic invariant cases and 12 security-boundary
cases, plus direct report aggregation tests. Repository evidence independently
verifies 31/31 recorded Somnia Shannon transaction receipts from the funded validation sample.

## License

MIT
