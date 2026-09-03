# TEMPO Build Status

Status as of 2026-09-02. The implementation, live reads, funded contract flow,
autonomous E2E writes, and receipt replay are complete. The only external
submission artifact not present in the repository is the recorded demo video.

## Verified

- The required live probe connected to Shannon and observed 14 live BTC/ETH
  windows, on-chain lifecycle states, opening boundaries, and the official price
  feed.
- `@tempo/core` provides decimal-derived quantization, fair value with real-feed
  volatility or `NO DATA`, risk controls, policies, journal replay, chain gates,
  explicit order expiry, writes with receipt checks, and settlement claims.
- `@tempo/engine` runs GENESIS and VECTOR through the full
  BIRTH -> ANCHOR -> GENESIS -> REPRICE -> ENDGAME -> LOCK -> SETTLE -> CLAIM ->
  ROLL lifecycle. Dry-run decisions are journaled and never sent.
- The CLI covers doctor, markets, book, watch, agents, firm, trade, positions,
  claims, activity, verify, settlements, faucet, and backtest.
- The fixed-viewport dashboard renders live books, feed observations, estimates,
  agents, journal activity, and settlements with provenance and honest
  `UNAVAILABLE`/`NO DATA` states.
- Offline tests pass: 13 files and 2,089 tests, including 2,048 deterministic
  economic invariant cases. Strict TypeScript checks pass for core, engine, and
  CLI. Live SDK/integration tests pass: 2 files and 3 tests;
  the separate live chain-gate passes 1/1.
- `README.md`, the 40-section `docs/FINAL.md`, dashboard captures, verification
  report, and the filled submission gate are present.
- `@somnia-chain/markets-sdk` remains pinned exactly to `0.29.0`.

## Funded Evidence

Two distinct funded Shannon signers completed the live contract sequence.
Confirmed evidence includes faucet, mintSet, post-only quote, cancel, maker
sell, VECTOR IOC, and explicit winning-side redemption. A live SDK-decoded
`PostOnlyWouldCross()` is recorded without inventing a failed-transaction hash.
The autonomous runs added confirmed maker receipts and completed a same-market
settlement/claim/roll. `tempo verify` checked 31 unique journal hashes and found
31 successful receipts with zero failures.

Reproduce the funded checks with:

```bash
npm run test:contract
npm run test:e2e
npm run cli -- verify
```

The runners preflight distinct keys, native STT, and `TEMPO_DRY_RUN=false` before
any write. Full same-window E2E settlement evidence passed on market `0x…10fad`;
see `test/reports/e2e-live.md` for the exact lifecycle and hashes.
