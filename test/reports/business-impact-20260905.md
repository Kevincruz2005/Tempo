# Business and Ecosystem Impact Snapshot

- Snapshot time: 2026-09-05 16:51 UTC
- Network: Somnia Shannon testnet (chain 50312)
- Evidence window: 2026-09-02T05:10:23.810Z through 2026-09-05T16:51:04.237Z
- Sources: local typed journal, live `/api/state`, and the bundled canonical DreamDEX documentation

## The dead-market problem, measured

At 2026-09-05T16:47:03.779Z, the live finalized-market snapshot contained 12 markets. **10 of 12 had `tradeCount: 0`; the other two had 2 and 3 trades.** This is a point-in-time chain/indexer snapshot, not an extrapolation to every DreamDEX market.

## TEMPO operating evidence

| Metric | Observed value | Source |
| --- | ---: | --- |
| Market births journaled | 2,381 (BTC 1,201 / ETH 1,180) | `market-birth` journal records |
| Agent decisions | 8,805 | `decision` journal records |
| Real order sends | 2,004 | non-dry `order-sent` records |
| Receipts | 1,378 | `order-receipt` records |
| Unique transaction hashes | 1,464 | unique journal `tx` values |
| Fills | 100 | `fill` records |
| Matched quote notional | 1,255.625 tUSDC | sum of journaled `fill.price × fill.size` |
| Claims | 13 | `claim` records |
| Scored markets | 18 | pre-expiry estimates paired with non-void settlements |
| Brier score | 0.0561 | deterministic journal aggregation |
| Directional accuracy | 94.4% | 17 of 18 scored outcomes |

## Live coverage

At 2026-09-05T16:47:03.779Z:

- 10 windows were actively trading: 5 BTC and 5 ETH.
- 8 of 10 were in TEMPO-managed cadences.
- 6 of 10 had a materialized two-sided book in TEMPO's managed set: 3 BTC and 3 ETH.
- Combined point-in-time two-sided managed-book coverage was **60% of all active windows** and **75% of managed active windows**.

Coverage is intentionally computed from live status, TEMPO's managed-cadence flag, and materialized UP bid/ask levels. It does not attribute unrelated venue liquidity to TEMPO.

## Revenue and venue economics

DreamDEX's canonical Event Contract documentation states that maker, taker, and settlement fees are currently **0%**. Therefore:

- Protocol fee revenue enabled by the observed fills: **0 tUSDC**.
- The useful impact metric is matched quote notional, not invented fee revenue.
- TEMPO's economic path is spread capture, settlement value, and DreamDEX's yield-funded maker incentives where applicable.
- DreamDEX's ecosystem benefit is tradable windows and increased matched activity without taxing users.

References: `docs/sources/raw/dreamdex-trading_event-contracts.md` and `docs/sources/raw/dreamdex-developers_event-contracts_market-structure.md`.

## External-flow status

The historical fill records in this snapshot identify the TEMPO agent whose user-fill stream observed each fill, but do not retain maker and taker wallet addresses. They cannot honestly prove an external counterparty. The runtime now journals public maker, taker, counterparty, and `FIRM`/`EXTERNAL` classification for future fills. A “Proven by External Traders” claim must remain absent until a new attributed fill is captured and independently verified.

## Sustainability

1. Liquidity Genesis makes otherwise empty rolling windows usable.
2. Usable books attract wallet traders and external agents.
3. More matched notional strengthens DreamDEX's market utility while its zero-fee model preserves trader value.
4. GENESIS can earn spread and venue maker yield; VECTOR can earn bounded mispricing edge.
5. Somnia's low transaction cost and a single autonomous Node.js process keep operating costs small.
6. The MIT-licensed SDK and MCP surface let other builders add assets, policies, and distribution without duplicating the lifecycle infrastructure.

No annual revenue, mainnet volume, external adoption, or future fill rate is projected here.
