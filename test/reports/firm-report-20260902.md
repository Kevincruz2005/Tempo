# TEMPO Firm Report

Window: `2026-09-01T18:25:23.203Z` → `2026-09-02T18:25:23.274Z` · all figures computed from the journal (real records only)

**Historical 2026-09-02 snapshot across 3 scored markets.**

## Runs
- Firm starts: **29** (13 live-configured, 16 dry-run) · clean shutdowns: 15 · accumulated uptime: 82.6 min

## Markets
- Windows born (observed live): **369** — ETH: 177, BTC: 192
- Decisions journaled: **6274** (with finite fair value: 2296)
- By agent: GENESIS: 1988, VECTOR: 1988

## Execution
- Order sends: **168 real**, 328 dry-run · receipts: 115 · cancels: 2
- Unique transaction hashes: **120** — verifiable via `tempo verify`
- Fills: **10** — GENESIS: 10
- Fill kinds: BUY_DOWN: 6, BUY_UP: 4
- Claims: **3** (3 txs)

## Estimate quality (historical MODEL ESTIMATE vs settlement fact)
- Markets scored: **3**
- **Brier score: 0.0723** (0 = perfect, 0.25 = coin-flip confidence, 1 = always wrong)
- Directional accuracy: **100.0%**
- Method: last fair-value estimate with ≤600 s remaining per resolved market, scored against the on-chain winning outcome; voided markets excluded.

## Risk engine
- Rejections: **1** — RISK_REJECTED: 1
  - 1× net inventory -50→-75 would exceed cap ±60

## Errors
- Total: **996** — decide: 74, market discovery: 835, settlement feed: 36, live tail unavailable — falling back to interval cycles: 8, place BUY_UP BTC-0-02SEP26-1200-11C5/tUSDC#YES: 1, post-only crossed (book moved into us) — will requote: 42
