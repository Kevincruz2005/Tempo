# TEMPO Build Status

Status as of 2026-09-02. The implementation and all unfunded verification are
complete. Submission remains blocked on two distinct testnet signers funded with
native STT; no transaction hash has been invented to fill that gap.

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
- Offline tests pass: 12 files and 27 tests. Strict TypeScript checks pass for
  core, engine, and CLI. Live SDK/integration tests pass: 2 files and 3 tests.
- `README.md`, the 40-section `docs/FINAL.md`, dashboard captures, verification
  report, and the filled submission gate are present.
- `@somnia-chain/markets-sdk` remains pinned exactly to `0.29.0`.

## Funded Evidence Blocker

`TEMPO_KEY_MAKER` and `TEMPO_KEY_TAKER` are absent. The contract and full-window
e2e runners stop before a send unless both keys are distinct and each signer has
at least 1 STT. Their BLOCKED reports are in `test/reports/contract-live.md` and
`test/reports/e2e-live.md`.

After funding the signers, run:

```bash
npm run test:contract
npm run test:e2e
npm run cli -- verify
```

Then refresh `test/reports/submission-gate.md` and the transaction-evidence
sections of `docs/FINAL.md` using only the hashes produced by those runs.
