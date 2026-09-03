# TEMPO - Final Build Record

> Delivered build status on 2026-09-02. Read-only, dry-run, and funded-write
> surfaces are live and tested on Somnia Shannon; all claimed hashes were
> replayed against chain receipts.

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
is explicit and journaled. Market `0x…10fad` completed ANCHOR, GENESIS, REPRICE,
ENDGAME, SETTLE, CLAIM, and ROLL with a confirmed winning-side redemption.

## 14. Architecture

`@tempo/core` feeds the engine; CLI calls core; web reads engine HTTP/SSE. The
engine is the autonomous writer. Evidence: package workspace and README.

## 15. Official Tooling

Markets SDK `0.29.0` is pinned and used through unified, client, trader, live
watch, reactivity, feed, chain and ABI surfaces. Evidence: lockfile and matrix.

## 16. CLI

Doctor, markets, watch, book, agents, positions, firm, trade, claims, activity,
verify, report, settlements, backtest and faucet execute through core. Evidence: CLI
matrix runs and `--help`; the final live report records 12/12 passing commands.

## 17. Reusable SDK

The public surface exports config, exchange, fair value, risk, policies,
decimal quantization, journal/replay, deterministic report aggregation, ledger,
types, claims and backtest.
The Node 20+ ESM build ships compiled JavaScript and TypeScript declarations as
GitHub Release `sdk-v0.1.0`, with checksum and CycloneDX SBOM assets. Evidence:
`packages/core/src/index.ts`, package metadata, and `sdk-release-20260903.md`.

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

There is no database or SQL query surface, so SQL injection is absent by
architecture. The dashboard is local-only by default, GET-only, same-origin and
Host-gated, rate/SSE bounded, path-contained, payload-redacted, and protected by
CSP/isolation headers; dynamic browser content is HTML-encoded and audit links
are HTTPS-only. No key means no write, keys must differ, malformed/off-grid
inputs fail locally, and live status is re-read before every trading mutation.
Evidence: 12 security tests, HTTP boundary probes, and the live chain-gate test.

## 22. Failure Model

Unavailable feeds/history, locked markets, expired plans, risk rejection,
post-only crossings, disconnect fallback, and void claims are named paths.
A funded live run captured the official SDK-decoded `PostOnlyWouldCross()` path
without inventing a hash that the thrown error did not expose.

## 23. Test Strategy

Offline logic is separated from live reads and funded writes. `npm test` never
requires RPC. Evidence: `test/` tree and scripts.

## 24. Test Folder

Unit, SDK, integration, contract, e2e, failure, security, economic, CLI,
fixtures, scripts and reports are present. Evidence: `test/`.

## 25. Test Results

Offline: 2,089/2,089 pass. Live SDK/integration: 3/3 pass. Live chain gate: 1/1 pass.
Funded contract flow: PASS. Autonomous same-window E2E lifecycle: PASS, including
settlement and claim hash `0xd9aad147…bf2ac5e`. Evidence: dated reports.

## 26. Deployment

No custom contract is required; deployment is config plus two funded Shannon
accounts. GENESIS and VECTOR used distinct addresses and completed real sends.

## 27. Demo Script

Show markets, start dry-run firm, inspect live estimate and lifecycle records,
then show the funded quote, IOC, settlement, claim, and receipt replay. The repo
includes a narrated 90-second live dashboard MP4 and preserves its raw capture.

## 28. Signature Moment

The dashboard makes a newborn window and both agents' reactions observable in
one viewport. Confirmed maker, taker, and claim hashes provide the proof path.

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
Transaction hashes claimed: 31 unique journal hashes; `tempo verify` found all
31 successful receipts and zero failures. Evidence: `zero-mock-audit.md` and
`verify-20260902.md` (15,316 records).

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

TEMPO demonstrates Somnia-native live state, placed real two-sided liquidity,
executed an independent IOC, and supplies a reusable EC SDK/CLI pattern.

## 37. Competitive Landscape

Compared with bot-kit `ec-maker`, TEMPO adds birth anchoring, independent taker,
explicit lifecycle, observed volatility, risk, claims and a verification plane.

## 38. Risks And Provenance

Moving venue ids, indexer lag, oracle voids, feed history gaps, gas funding and
thin books are handled explicitly. The per-feature provenance table is in the
README.

## 39. Judge Score Prediction

Delivered product: novelty 8, EC necessity 10, DreamDEX depth 9, Somnia fit 9,
agents 9, demo 7, feasibility 9, SDK 9, startup 8, memorability 8.
Evidence-adjusted prediction: **9.0/10**; the narrated live recording and chain
proof are present, while final organizer-platform upload remains execution risk.

## 40. 30-Second Pitch

Every few minutes DreamDEX births a new prediction market, and it can be born
without a usable opening book. TEMPO is an autonomous firm that anchors that
birth to the official feed, quotes both outcomes, lets an independent agent
challenge the touch, then follows the window through settlement and claim.
It runs on Somnia's live on-chain event path, ships as SDK, CLI and dashboard,
and labels every fact, estimate and missing value. The read path is proven;
31 unique funded transaction hashes have independently verified receipts.
