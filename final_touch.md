# FINAL TOUCH — Implementation Brief for Codex

> **Purpose:** close the remaining gaps to full submission readiness for the
> Somnia × DreamDEX Event Contracts Hackathon (deadline 2026-09-08).
> **Authority:** this file supersedes nothing — it extends `AGENTS.md` and the
> master checklist (`Tempo_Master_Checklist_AZ_Upgrade.md`). Every feature
> below cites its checklist section.
>
> **HARD CONSTRAINTS — apply to every feature:**
> 1. **Zero-mock**: no fabricated prices, hashes, balances, or analytics. Ever.
>    Unavailable = `UNAVAILABLE`/`NO DATA`, honestly rendered (§14, §47).
> 2. **Risk engine is sacred**: no new write path may bypass `RiskEngine`
>    (packages/core/src/risk.ts) — browser trades, MCP writes, calibration
>    outputs all route through it (§20, §69).
> 3. **Keys stay out**: never in repo, browser, health responses, MCP tools,
>    logs, or journal records (§55).
> 4. **Estimate vs fact**: every model/LLM output is labeled `AI ESTIMATE` or
>    `AI NARRATIVE`; chain reads are `CHAIN FACT` (§12).
> 5. **No regressions**: `npm test` (28 offline tests) and all three packages'
>    `tsc --noEmit` must stay green after every feature; add tests per feature.
> 6. **CLI and web share core**: any logic a feature needs goes into
>    `@tempo/core` or `@tempo/engine` — never duplicated (§26).

---

## Execution order (recommended)

1. Health/Readiness (smallest, unblocks ops evidence)
2. Connect Wallet
3. AI: Calibration loop + MCP server
4. Full on-chain mode evidence
5. Docs page (SDK section mandatory)
6. README A–Z rewrite
7. Final checklist check + GitHub commit/push

---

## 1. Health & Readiness endpoints — checklist §62/§64

**Where:** `packages/engine/src/server.ts` (+ tests in `test/unit/` and
`test/integration/`).

- `GET /health` → `200 {"status":"ok","service":"tempo","version":"<from root package.json>"}`
  - No dependency checks, no secrets, no URLs, no agent addresses, no journal
    contents. Deterministic, <5 ms, no chain/indexer calls.
- `GET /ready` → `200` when the service can accept work; `503` otherwise.
  Check (each cached with a 5 s TTL so scraping `/ready` never spams upstreams):
  - indexer reachable (cheap GraphQL query, e.g. `countBinaryMarkets`)
  - live tail state (`client.isTailing()`) — only when a watch was requested
  - RPC head advancing (last known block age < 30 s)
  - price feed reachable per configured asset
  - Optional dependencies (e.g. LLM key absent) must NOT fail readiness.
- Response bodies must never include environment variables, RPC URLs, private
  keys, wallet addresses, or stack traces (§62 security tests).
- Add automated tests: healthy-path 200, dependency-failure 503 (mock the
  dependency probe), no-secret-leak assertion, malformed-request handling.
- Document both endpoints in README + docs page.

**Evidence:** `test/reports/health-endpoint.md` with real curl outputs.

## 2. Connect Wallet — checklist §70

**Where:** `packages/web/public/` (UI), new `packages/core/src/wallet.ts`
(core logic so CLI/docs can reuse it), tests in `test/unit/wallet.test.ts`
and `test/integration/`.

- Integrate EIP-6963 wallet discovery with `window.ethereum` fallback; use
  viem's wallet clients (the markets-sdk accepts a `walletClient` in the
  browser — the SDK README documents this path; do NOT reinvent signing).
- **Expected chain:** show a wrong-network banner when the provider's chain is
  not the configured network (50312 testnet / 5031 mainnet); offer chain
  switch; handle rejection and unsupported wallet.
- **What the wallet can do (keep minimal and honest):**
  1. Connect/disconnect; display truncated address + chain id + native balance
     (all real provider reads; nothing cached across reconnects).
  2. Watch: the connected address's fills/orders on watched markets, rendered
     in the activity tape with its own color — attribution via the live store
     (`getLiveUserFills(null, address)`), read-only.
  3. Manual trade (one action only): place an IOC order through the SAME core
     path as `tempo trade`. Before signing, render the full pre-sign summary:
     market symbol, side (Up/Down), size, limit price, order expiry, worst-case
     cost, and the window's seconds-left. After signing, display only real
     provider/chain state (tx hash, receipt status). No blind signing, ever.
- **Forbidden:** seed phrases, private keys in the frontend, the engine's
  agent keys in the browser, any signature request not rendered in the
  pre-sign summary first.
- Handle: account switch, chain switch, rejected signature, cancelled tx,
  insufficient balance (pre-check via provider before requesting signature),
  expired market (chain-gate on status 1 before offering the button),
  provider disconnect, malformed provider responses.
- Engine/agents are untouched by this feature — the wallet is the *human's*
  key, strictly separate from GENESIS/VECTOR keys (§11 multi-agent separation).

**Evidence:** `test/reports/wallet-flow.md` — screenshots of each state
(connected, wrong network, rejection, pre-sign summary, receipt) captured
against the real testnet.

## 3A. AI: Calibration loop (the valid-AI centerpiece) — checklist §69

**Where:** new `packages/core/src/calibration.ts` + a cold-path loop in
`@tempo/engine` + CLI command `tempo calibrate`. Tests in
`test/unit/calibration.test.ts`.

**Rationale (record this in the docs):** the appraiser's fair-value estimates
are journaled before action and settlements arrive as on-chain facts, so the
firm can *score itself* — the report already computes a real Brier score
(0.072 on the 2026-09-02 run). The calibration loop closes that loop: the firm
learns from its own measured outcomes. This is the "AI materially influences
intended behavior + learns from historical performance" requirement, satisfied
with deterministic, auditable math — no LLM in the hot path (100 ms blocks).

**Mechanics:**
- After each claim sweep, gather scored estimates per the report's Brier
  method (last pre-expiry estimate per resolved market; voided excluded).
- Maintain a rolling window (last 30 scored markets). Compute Brier and
  calibration error (mean `p̂ − y`).
- Adjust exactly two bounded parameters, both clamped to `[0.5×, 2.0×]` of
  their env defaults:
  - `sigmaMultiplier` — if Brier worsens while directional accuracy holds,
    widen the fair-value band (uncertainty up); if Brier is dominated by
    overconfidence near 0/1, widen more.
  - `takerEdge` — if VECTOR's fills underperform (compare entry fairP to
    settlement outcomes), raise its edge threshold; if it is well-calibrated
    and starved of fills, lower it by at most one tick-step per epoch.
- **One adjustment per epoch** (≥25 scored markets), never per market.
- Every adjustment is journaled as type `"calibration"` with: epoch id, scored
  count, Brier before/after target metric, old params → new params, clamp
  status, and the human-readable reason. Adjustments apply to NEW decisions
  only; never rewrite history.
- `tempo calibrate [--force]` runs the epoch on demand and prints the same
  record; `--force` bypasses only the epoch-size gate, never the clamps.
- Persistence: a small JSON file under `journal/` (gitignored) — current
  multipliers + epoch history. Loading is fail-safe: corrupt file = defaults,
  journaled as an error, never a crash.
- All of this stays inside the firm's own process; agents cannot modify risk
  *caps* (§69: deterministic safety controls remain outside the model — the
  RiskEngine reads env-configured caps only; calibration touches pricing
  parameters, never limits).

**Evidence:** unit tests covering: monotone clamping, epoch gating, Brier
math on synthetic outcomes, corrupt-state recovery; `test/reports/calibration.md`
with one real epoch from live journal data.

## 3B. MCP server — checklist §68

**Where:** new package `packages/mcp` (`@tempo/mcp`), dependency
`@modelcontextprotocol/sdk`, stdio transport; CLI entry
`tempo mcp [--port N]` later optional. Tests in `test/integration/mcp.test.ts`.

**Tool surface (read tools — implement all):**
`discover_markets`, `inspect_event_contract` (on-chain state + book params +
opening price), `get_live_book`, `get_market_state`, `get_fair_value` (must
include the `AI ESTIMATE` label and the inputs: spot, strike, sigma, seconds
left), `get_risk_state`, `get_positions`, `get_settlement` (incl. oracle
explorer URL), `get_activity` (journal tail), `verify_receipt` (on-chain
receipt lookup by hash).

**Write tools (guarded):**
- `simulate_trade` — ALWAYS dry-run: builds the order, runs `RiskEngine`,
  returns the verdict + would-be plan. Never sends. Safe by construction.
- `place_order` — exists ONLY when env `TEMPO_MCP_WRITES=true` AND an agent
  key is configured; routes through the same `Executor` + `RiskEngine` path as
  the firm; subject to the same caps; journaled with `agent: "MCP"`.
- **No tool ever exposes, accepts, or signs with a raw private key.** No tool
  returns environment variables or credentials. Tool args are schema-validated
  (zod) before any core call. Every tool call is journaled (`type: "mcp"`,
  tool name, args hash, result summary). Per-call timeout 10 s; loop limits on
  list tools.

**Testing:** real integration test driving the server over stdio against the
live testnet reads; write-path test with `TEMPO_MCP_WRITES=false` asserting
`place_order` is refused; injection test (malformed market ids, oversized
args). Document the server in the docs page + README with a Claude Desktop /
MCP-client config snippet.

## 4. Full on-chain mode evidence — checklist §65

- Confirm `.env`: `TEMPO_DRY_RUN=false`, both keys set (already true).
- Run the firm through at least one full window lifecycle in live mode and
  capture the complete chain:
  `discovery → decision (with inputs) → order-sent → receipt (tx hash) →
  fill → settlement → claim → tempo verify`.
- Record in `test/reports/full-onchain-mode.md`: every tx hash, receipt
  status, agent, marketId, timestamps; explicitly note any reverted tx as
  reverted (never as success).
- If a mainnet instance is ever authorized, it is a config switch
  (`TEMPO_NETWORK=mainnet`, `PRICE_FEED_URL` must be resolved first — verify a
  mainnet feed endpoint exists before claiming mainnet support anywhere).

## 5. Documentation page (SDK section MANDATORY) — checklist §58/§63

- Build a static docs page (zero-build preferred: a small `docs-page/` static
  site or docsify-style index served by the engine at `/docs`, or GitHub
  Pages from the repo). Navigation must include every §58 section.
- **The Node.js SDK gets its own section** (`@tempo/core`): install,
  quick-start snippet (real code from `test/` — no invented outputs),
  full public API reference (every exported class/function from
  `packages/core/src/index.ts` with types, errors, and a usage example),
  testnet signer setup, error catalog (TempoError codes), and the provenance
  model. State Node ≥ 20.
- Include: MCP server setup + tool catalog; wallet flow; health/readiness;
  the calibration loop (with the real Brier number as the worked example);
  configuration reference (every `TEMPO_*` env var from `.env.example`).
- Every example must be reproducible from a clean clone — run them before
  publishing the page (§63: "SDK examples reproducible from a clean
  environment").

## 6. README A–Z rewrite — checklist §71

Rewrite `README.md` following the §71 outline exactly (What is Tempo → … →
Evidence Links). Requirements:
- Every claim currently true; every command tested before it is documented.
- Structure mirrors the docs page; the README links to it.
- Include the §71 sections explicitly: novelty statement, GENESIS/VECTOR
  descriptions, wallet flow, full on-chain mode, testing evidence (current
  counts — update after the test expansion lands), live-transaction evidence
  with sample real hashes, limitations (say them honestly: testnet scale,
  indexer lag behavior, oracle dependency), roadmap (mainnet, operator-scoped
  browser keys, soft-information markets), competitive differentiation table
  (vs bot-kit ec-maker: genesis anchoring vs mid-following, reactivity vs
  10 s polling, full lifecycle vs quote-only), and Evidence Links to
  `test/reports/*`.

## 7. Full checklist check — §67

Produce `test/reports/final-checklist.md`: every item of the master
checklist classified `PASS` / `FAIL` / `N-A — JUSTIFIED` / `BLOCKED — WITH
EXPLICIT REASON`, with an evidence pointer per row. Release-blocking items
(zero-mock, secrets, tests, on-chain proof) must be PASS before submission.

## 8. Commit & push — §66

- `git status` reviewed; evidence + docs + new packages committed; **no
  `.env`, no `journal/`, no private keys** (`.gitignore` already covers —
  verify with `git status --porcelain` before committing).
- Accurate commit message; push to `origin main`; record the final SHA in
  `test/reports/release.md` alongside SDK version and docs version.

---

## Definition of done (whole file)

```text
/health = 200, no-leak tested            → PASS
/ready = 200/503 with cached probes      → PASS
Wallet: all §70 states tested + screens  → PASS
Calibration loop: clamped, journaled, tested on real data → PASS
MCP: 10 read tools + guarded writes, tested over stdio    → PASS
Docs page: all §58 sections, SDK referenced, examples run → PASS
README: §71 outline, every claim true     → PASS
Full on-chain evidence: one lifecycle, hashes recorded    → PASS
final-checklist.md: every item classified → PASS
Committed + pushed, SHA recorded          → PASS
npm test green, tsc green on all packages → PASS (gate for everything above)
```
