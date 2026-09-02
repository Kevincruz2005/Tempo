# CLI Live Report

- Run at: 2026-09-02T05:49:18.936Z

## doctor

- Status: PASS
- Exit: 0

```text
TEMPO doctor — probing chain, indexer, feed, keys
network:        testnet
indexer:        https://dev.smk.somnia.host/v1/graphql
rpc:            https://api.infra.testnet.somnia.network
ws rpc:         wss://api.infra.testnet.somnia.network/ws
price feed:     https://price-feed.dev.oracle.somnia.host/v1/graphql
dry run:        true
maker key:      ABSENT (read-only)
taker key:      ABSENT (read-only)
live markets:   14 (managed assets: BTC,ETH)
collateral:     0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E (6 decimals)
feed BTC:     77719.65 (ema 77716.43)
feed ETH:     2422.57 (ema 2422.34)

```
## markets

- Status: PASS
- Exit: 0

```text
symbol                                  asset cad  left   venue       marketId
BTC-7767485-02SEP26-0550/tUSDC          BTC   5m   118s   0x1a1e6821  0x0000000000
BTC-0-02SEP26-0550/tUSDC                BTC   5m   118s   0x679795a0  0x0000000000
ETH-242013-02SEP26-0550/tUSDC           ETH   5m   118s   0x1a1e6821  0x0000000000
ETH-0-02SEP26-0550/tUSDC                ETH   5m   118s   0x679795a0  0x0000000000
BTC-0-02SEP26-0600-0E1C/tUSDC           BTC   15m  718s   0x679795a0  0x0000000000
ETH-0-02SEP26-0600-0E1D/tUSDC           ETH   15m  718s   0x679795a0  0x0000000000
BTC-0-02SEP26-0600-0D95/tUSDC           BTC   60m  718s   0x679795a0  0x0000000000
ETH-0-02SEP26-0600-0D96/tUSDC           ETH   60m  718s   0x679795a0  0x0000000000
BTC-0-02SEP26-0800/tUSDC                BTC   240m 7918s  0x679795a0  0x0000000000
ETH-0-02SEP26-0800/tUSDC                ETH   240m 7918s  0x679795a0  0x0000000000
BTC-0-03SEP26/tUSDC                     BTC   1440m65518s 0x679795a0  0x0000000000
ETH-0-03SEP26/tUSDC                     ETH   1440m65518s 0x679795a0  0x0000000000

12 live windows — the venue's own rolling series

```
## book

- Status: PASS
- Exit: 0

```text
market:   BTC-7772287-02SEP26-0549/tUSDC  (BTC 1m, 41s left)
strike:   77722.87
spot:     77712.93  [price-feed]
grid:     tick 0.001 lot 0.001 (6 decimals)

YES book (Up probability):
  0.275 × 460.0
  0.265 × 330.0
  0.256 × 200.0
  --- touch ---
  0.229 × 200.0
  0.220 × 330.0
  0.210 × 460.0

```
## agents

- Status: PASS
- Exit: 0

```text
== GENESIS (no key — READ-ONLY)
== VECTOR (no key — READ-ONLY)

```
## positions

- Status: PASS
- Exit: 0

```text
== GENESIS (no key — READ-ONLY)
== VECTOR (no key — READ-ONLY)

```
## claims

- Status: PASS
- Exit: 0

```text
0x000000000000  winner UP  held UP UNAVAILABLE / DOWN UNAVAILABLE  
   oracle: https://prd.oracle.somnia.host/questions/102820246331144507261851525700190883151046505653132727168000658054560938062607?view=graph
0x000000000000  winner UP  held UP UNAVAILABLE / DOWN UNAVAILABLE  
   oracle: https://prd.oracle.somnia.host/questions/93190715061493695305828562701719189211726760776174017683713867021404250719665?view=graph
0x000000000000  winner UP  held UP UNAVAILABLE / DOWN UNAVAILABLE  
   oracle: https://prd.oracle.somnia.host/questions/17980486801500849878950078688856346963250907291448531146720908725920247011502?view=graph

```
## activity

- Status: PASS
- Exit: 0

```text
05:39:51 price           firm     {"asset":"ETH","price":2419.535,"ema":2419.480438072031,"ts":1788327589000}
05:39:51 shutdown        firm     {"uptimeMs":24521}
05:44:16 startup         firm     {"network":"testnet","dryRun":true,"maker":"READ-ONLY","taker":"READ-ONLY","managedCadences":[60,300,900,3600]
05:46:38 startup         firm     {"network":"testnet","dryRun":true,"maker":"READ-ONLY","taker":"READ-ONLY","managedCadences":[60,300,900,3600]
05:47:31 startup         firm     {"network":"testnet","dryRun":true,"maker":"READ-ONLY","taker":"READ-ONLY","managedCadences":[60,300,900,3600]

```
## verify

- Status: PASS
- Exit: 0

```text
journal records (7d): 2077, carrying tx hashes: 0

verified 0/0 transaction hashes against testnet (failed: 0)

```
## settlements

- Status: PASS
- Exit: 0

```text
ETH 1m expired 2026-09-02T05:48:00.000Z  trades 0  last —
   oracle: https://prd.oracle.somnia.host/questions/102820246331144507261851525700190883151046505653132727168000658054560938062607?view=graph
BTC 1m expired 2026-09-02T05:48:00.000Z  trades 0  last —
   oracle: https://prd.oracle.somnia.host/questions/93190715061493695305828562701719189211726760776174017683713867021404250719665?view=graph
ETH 1m expired 2026-09-02T05:47:00.000Z  trades 0  last —
   oracle: https://prd.oracle.somnia.host/questions/17980486801500849878950078688856346963250907291448531146720908725920247011502?view=graph

```
## backtest

- Status: PASS
- Exit: 0

```text
real-feed midpoint fair-value backtest (AI ESTIMATE; finalized outcome is chain fact)
ETH  2026-09-02T05:48:00.000Z  NO DATA (real midpoint feed history, volatility, or opening boundary unavailable)
BTC  2026-09-02T05:48:00.000Z  NO DATA (real midpoint feed history, volatility, or opening boundary unavailable)
ETH  2026-09-02T05:47:00.000Z  NO DATA (real midpoint feed history, volatility, or opening boundary unavailable)
mean Brier: NO DATA

```
## watch

- Status: PASS
- Exit: timeout

```text
watching 6 windows (live tail) — ctrl-c to stop

```
## firm

- Status: PASS
- Exit: 0

```text
TEMPO firm — SIMULATE (decisions journaled, nothing sent)
dashboard: http://localhost:7533

```
