# TEMPO - Final Build Record

> Delivered build status on 2026-09-02. Read-only/dry-run surfaces are live and
> tested. Funded transaction evidence is explicitly blocked, not fabricated.

## 1. Project Name

**TEMPO: the autonomous opening auction for DreamDEX Event Contracts.**
Evidence: [README](../README.md) and live dashboard captures in
`test/reports/dashboard-*.png`.

## 2. One-Line Thesis

Every ephemeral market should open with an anchored two-sided book, not wait
for two traders to meet by accident. Evidence: live probe and market discovery.

## 3. Problem

DreamDEX windows are born empty and expire quickly; captured finalized rows
show zero-trade windows. Evidence: `probe/live-probe.ts` and
`port-codex/live-evidence/probe-output-2026-09-01.txt`.

## 4. Solution

GENESIS quotes the opening; VECTOR independently takes dislocated touches; the
firm settles, claims, and rolls. Evidence: `packages/engine/src/firm.ts`.

## 5. Why Somnia

Live watches, reactivity, rapid finality, and one-round-trip sends make a
machine-cadence on-chain CLOB viable. Evidence: `docs/RECONNAISSANCE.md`.

## 6. Somnia-Native Removal Test

Removing Somnia removes the live event tail and execution cadence that the firm
uses; this is not a generic scheduled EVM bot. Evidence: engine watch/poll state.

## 7. Why DreamDEX

The one-book/two-outcome structure, mint-a-pair path, opening boundary,
mandatory expiry, and finalized redemption define the product. Evidence:
`packages/core/src/exchange.ts`.

## 8. Event Contract Necessity

Without rolling binary windows there is no birth, opening auction, expiry,
oracle settlement, claim, or roll lifecycle. Evidence: lifecycle journal.

## 9. GENESIS Agent

Pure policy generates post-only Buy Up plus Buy Down opening liquidity and
inventory-aware replacement plans. Evidence: `policies.ts` and unit tests.

## 10. VECTOR Agent

Pure policy takes IOC only when its fair estimate clears the configured edge
and risk limits. Evidence: policy/economic tests.

## 11. Market Structure

State is keyed by market id, never recycled pool address; two-sided genesis can
use mint-a-pair with zero initial inventory. Evidence: engine maps and design.

## 12. Economic Model

Spread, proximity yield, bounded inventory, and explicit capital/loss/order
caps define returns and risk. Evidence: `risk.ts`, ledger/economic tests.

## 13. Lifecycle

`BIRTH -> ANCHOR -> GENESIS -> REPRICE -> ENDGAME -> LOCK -> SETTLE -> CLAIM -> ROLL`
is explicit and journaled. Live dry-run observed ANCHOR/GENESIS/REPRICE/ENDGAME.

## 14. Architecture

`@tempo/core` feeds the engine; CLI calls core; web reads engine HTTP/SSE. The
engine is the autonomous writer. Evidence: package workspace and README.

## 15. Official Tooling

Markets SDK `0.29.0` is pinned and used through unified, client, trader, live
watch, reactivity, feed, chain and ABI surfaces. Evidence: lockfile and matrix.

## 16. CLI

Doctor, markets, watch, book, agents, positions, firm, trade, claims, activity,
verify, settlements, backtest and faucet execute through core. Evidence: CLI
matrix runs and `--help`; the final live report records 12/12 passing commands.

## 17. Reusable SDK

The public surface exports config, exchange, fair value, risk, policies,
decimal quantization, journal/replay, ledger, types, claims and backtest.
Evidence: `packages/core/src/index.ts` and 14 core unit tests.

## 18. Agent Coordination

Keys, ledgers, policies and executors remain separate; a shared RiskEngine
gates every plan. Missing keys produce `UNAVAILABLE`. Evidence: live journal.

## 19. Real Data Flow

Official feed + market boundary + live book + balances flow into estimate,
risk, plan, receipt and journal. No intercepted API layer exists.

## 20. Contract Flow

Trading writes require live status `1`; raw binary orders carry explicit ns
expiry and receipt checks; redemption requires resolved/voided state and an
explicit outcome. Evidence: exchange wrapper and contract runner.

## 21. Security

No key means no write, keys must differ, malformed/off-grid inputs fail locally,
and live status is re-read before every trading mutation. Evidence: 3 security
tests plus live chain-gate test.

## 22. Failure Model

Unavailable feeds/history, locked markets, expired plans, risk rejection,
post-only crossings, disconnect fallback, and void claims are named paths.
Funded crossing/revert evidence remains pending.

## 23. Test Strategy

Offline logic is separated from live reads and funded writes. `npm test` never
requires RPC. Evidence: `test/` tree and scripts.

## 24. Test Folder

Unit, SDK, integration, contract, e2e, failure, security, economic, CLI,
fixtures, scripts and reports are present. Evidence: `test/`.

## 25. Test Results

Offline: 27/27 pass. Live SDK/integration: 3/3 pass. Live chain gate: 1/1 pass.
Funded contract/e2e: BLOCKED. Evidence: dated reports.

## 26. Deployment

No custom contract is required; deployment is config plus two funded Shannon
accounts. Current workspace supplied neither key, so zero sends occurred.

## 27. Demo Script

Show markets, start dry-run firm, inspect live estimate and lifecycle records,
then with funded keys show quote, IOC, settlement, claim, and verify. The last
stage is not yet recorded and must not be represented as complete.

## 28. Signature Moment

The dashboard makes a newborn window and both agents' reactions observable in
one viewport. A real maker/taker/claim hash sequence is pending funded keys.

## 29. UI

Fixed 1440x900 layout includes windows, selected book/estimate, agents,
activity, and settlements. Mobile preserves the core window view. Evidence:
two PNG captures under `test/reports/`.

## 30. Motion

Only journal-backed market births and fills animate; no decorative fake market
activity is generated. Evidence: SSE event handling in `app.js`.

## 31. Observability

Typed JSONL records capture source, timestamp, inputs, decision, error, block
and hash. `tempo verify` checks every journal hash against chain receipts.

## 32. Zero-Mock Audit

Production grep found no volatility fallback, hardcoded 6-decimal conversion,
or failed-read-to-zero path. Missing state is labeled. Production fixtures: 0.
Transaction hashes claimed: 0, because no transaction was sent. Evidence:
`test/reports/zero-mock-audit.md` and `verify-20260902.md` (2,120 records).

## 33. SDK Utilization Audit

Unified tier handles symbols/human reads; client tier handles registry, chain
truth, params, watches and history; trader tier handles explicit orders,
faucet and redeem. Spot HTTP/WS non-use is justified because it lacks ECs.

## 34. Reproducibility

`npm install`, `.env`, `npm test`, live tests, CLI and dry-run dashboard are
documented in README. Funded runners preflight two keys and STT.

## 35. Startup Potential

The opening service generalizes to other ephemeral series and venue-managed
liquidity. The moat is reactive operation, appraiser/risk policy, and audit
history.

## 36. Ecosystem Impact

TEMPO demonstrates Somnia-native live state and supplies a reusable EC SDK/CLI
pattern for agent operators. Real liquidity impact awaits funded deployment.

## 37. Competitive Landscape

Compared with bot-kit `ec-maker`, TEMPO adds birth anchoring, independent taker,
explicit lifecycle, observed volatility, risk, claims and a verification plane.

## 38. Risks And Provenance

Moving venue ids, indexer lag, oracle voids, feed history gaps, gas funding and
thin books are handled explicitly. The per-feature provenance table is in the
README.

## 39. Judge Score Prediction

Delivered read-only product: novelty 8, EC necessity 10, DreamDEX depth 8,
Somnia fit 9, agents 7, demo 6, feasibility 8, SDK 9, startup 8, memorability 8.
Evidence-adjusted prediction: **8.0/10**, capped by absent write proof.

## 40. 30-Second Pitch

Every few minutes DreamDEX births a new prediction market, and it can be born
without a usable opening book. TEMPO is an autonomous firm that anchors that
birth to the official feed, quotes both outcomes, lets an independent agent
challenge the touch, then follows the window through settlement and claim.
It runs on Somnia's live on-chain event path, ships as SDK, CLI and dashboard,
and labels every fact, estimate and missing value. The read path is proven;
funded transaction proof remains the final submission blocker.
