# BUILD_PLAN.md — ordered tasks with acceptance gates

> Live build status. Codex: pick up at the **first unchecked box**, in order.
> Each task lists its acceptance criteria — done means criteria met and
> evidence recorded (real output, real tx hashes). Read `AGENTS.md` first.

## Status legend
- [x] done & verified · [~] partially done (see notes) · [ ] not started

---

## Phase 0 — Reconnaissance & design (DONE)
- [x] Ecosystem reconnaissance (Somnia docs, DreamDEX docs, markets-sdk source, bot-kit source) → `docs/RECONNAISSANCE.md`
- [x] 15-candidate ideation + weighted scoring + winner's 40-section design → `docs/DESIGN.md`
- [x] Live testnet probe (14 live windows, opening prices, price feed, empty-book evidence) → `probe/live-probe.ts`
- [x] Workspace + deps (`@somnia-chain/markets-sdk@0.29.0`, `viem`, `tsx`)
- [x] `AGENTS.md` guardrails

## Phase 1 — @tempo/core (pure logic + SDK wrapper)
- [x] `src/types.ts` — Provenance, JournalRecord, MarketSnapshot, QuotePlan, TakerPlan, RiskConfig, typed errors
- [x] `src/config.ts` — env loading, per-network endpoints/addresses/chains (from RECONNAISSANCE §2, never hardcoded per-call)
- [x] `src/quant.ts` — probToTicks / ticksToProb / sizeToLots / lotsToSize (bigint, decimals-derived)
- [x] `src/fairValue.ts` — driftless diffusion fair value P(close≥open) + uncertainty band; realized σ from feed candles; endgame behavior
- [x] `src/risk.ts` — RiskEngine: per-window inventory, notional caps, open-order caps, firm capital, loss caps → allow/reject{reason}
- [x] `src/policies.ts` — GenesisMaker.quotePlan() and TakerPolicy.takerPlan() — pure functions over real inputs
- [x] `src/journal.ts` — typed JSONL journal: append/tail/since/replay (events → decisions → txs)
- [x] `src/exchange.ts` — TempoExchange wrapper: markets(), book(), opening(), spot(), trade() (IOC), quote() (post-only), mintSet, cancelAll, claims(), claim(), positions(), faucet; read-only without key; receipt checks; chain-gating helper
- [x] `src/index.ts` — public surface
- **Acceptance:** `npx vitest run test/unit` green with no network; public surface matches DESIGN §17.

## Phase 2 — @tempo/engine (agent firm runtime)
- [x] `src/firm.ts` — Firm: two agents (GENESIS maker, VECTOR taker), per-market state machine (BIRTH→ANCHOR→GENESIS→REPRICE→ENDGAME→LOCK→SETTLE→CLAIM→ROLL), live-watches event loop w/ poll fallback, execution through core
- [x] `src/server.ts` — HTTP + SSE server: firm state, market snapshots, journal tail; serves packages/web
- [x] DRY_RUN mode (`TEMPO_DRY_RUN=1`): full decision pipeline, zero sends, clearly labeled in journal + UI
- **Acceptance:** `npm run firm` runs two agents against live testnet (DRY_RUN default true); decisions journaled with inputs; `npm run web` shows live state.

## Phase 3 — tempo CLI
- [x] commands: `doctor markets watch book agents firm trade positions claims activity verify settlements faucet backtest` (DESIGN §16), all via `@tempo/core`
- **Acceptance:** every command runs against live testnet (read-only ones with no key); `--help` documents each.

## Phase 4 — tests + live evidence (DONE)
- [x] `test/unit/*` vitest: fairValue, quant, risk, policies, journal, config (offline, no mocks of chain data — synthetic math fixtures only)
- [x] `test/sdk/*` live read-only SDK surface tests
- [x] `test/contract/*` real txs: faucet → mintSet → post-only quote → cancel → IOC take → redeem (record hashes in `test/reports/`)
- [x] `test/failure/*` locked-market chain gate, underfunded local reject, expired local order, and funded SDK-decoded `PostOnlyWouldCross()` evidence
- [x] `test/economic/*` caps bind, spread accounting, endgame convergence
- [x] `test/cli/*` every command
- [x] `test/e2e/*` full window lifecycle on real market `0x…10fad`: ANCHOR → GENESIS → REPRICE → ENDGAME → SETTLE → CLAIM → ROLL with confirmed claim
- **Acceptance:** `npm test` green offline suites; live suites run by script with evidence files (real hashes only).

## Phase 5 — web dashboard
- [x] single-screen panels: venue pulse (windows + birth clock), book + fair-value band, firm roster (real capital/inventory/P&L), activity tape (journal → SSE), settlements (oracle explorer links)
- **Acceptance:** no page scroll at 1440×900; every number provenance-tagged; honest NO DATA states.

## Phase 6 — docs, audits & submission gate (DONE)
- [x] README.md (reproducibility §34), zero-mock audit (§32), SDK utilization matrix (§33), demo script (§27), per-feature provenance table (§38)
- [x] `docs/FINAL.md` — the 40-section output (DESIGN Part II) refreshed with real build evidence (per port-codex/05 Part C)
- [x] Run the pre-submission gate (`port-codex/05-SUBMISSION-GATE.md` Part B) → filled checklist saved to `test/reports/submission-gate.md`
- [x] `tempo verify` output attached under `test/reports/`; 31/31 unique journal transaction hashes verified successful on Shannon

## Handoff notes for Codex (observed on the live deployment 2026-09-01)
- Testnet has TWO live venue ids right now: 1m/5m series on
  `0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7db3ba94f8648a5a050f`,
  15m+ on `0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c`.
  Don't hardcode: read `venueId` off live rows; `TEMPO_VENUE_ID` filters when set.
- `client.listLiveBinaryMarkets()` rows lack `outcomes` — get yes/no symbols
  from the unified tier (`loadMarkets(true)` + `isBinaryMarket`) and join on
  marketId/symbol.
- `getOpeningPrices()` returns raw values that scale as price×100 on testnet
  (BTC strike 7750120 ⇔ $77,501.20; ETH 243244 ⇔ $2,432.44). Validate at
  runtime against the price feed (`fetchPrice`) — derive/match scale, journal
  any mismatch, never assume silently.
- `fetchPrice(asset)` returns `{price, ema, info.raw.{price,ema}}` — raw is
  18-decimal. Use `info.raw` when exactness matters; floats only for display.
- Writes confirm in one round trip via `realtime_sendRawTransaction` (SDK
  fixed fees: 60 gwei ceiling / 0 tip, 10M gas ceiling — funded envelope ≈0.6
  STT/order; keep wallet above it).
- If everything else fails, `probe/live-probe.ts` is the ground-truth
  connectivity check.
