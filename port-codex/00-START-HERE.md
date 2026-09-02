# PORT-CODEX — one-tap build brief for TEMPO

> **You (the coding agent) are building TEMPO**: an autonomous "opening auction"
> firm for **DreamDEX Event Contracts** on the **Somnia** blockchain. Every
> DreamDEX event-contract window (binary Up/Down on BTC/ETH price over a fixed
> window — 1m/5m/15m/60m on testnet) is **born with an empty order book**, an
> on-chain opening price, and a hard expiry. TEMPO is a firm of two autonomous
> agents — **GENESIS** (maker: anchors the opening two-sided quote to fair
> value, re-prices reactively, manages the endgame, claims settlement, rolls to
> the successor window) and **VECTOR** (taker: independent policy that takes
> IOC positions when its fair value diverges from the touch) — that run this
> full lifecycle with zero human intervention, zero mocked values, shipped as
> **core SDK + CLI + web dashboard** with an aggressive test suite and real
> testnet evidence.

Everything you need is in this folder. **Do not re-research the ecosystem** —
it is already done and live-verified. Read in this order:

| # | File | What it gives you |
|---|------|-------------------|
| 0 | `00-START-HERE.md` | This file — the brief, the build order, the critical facts |
| 1 | `01-RECONNAISSANCE.md` | **The verified ecosystem map**: why Somnia exists, DreamDEX market mechanics, every endpoint/address/SDK surface. Live-verified facts are marked. |
| 2 | `02-DESIGN.md` | **The full product design**: 15 scored candidate ideas → winner, then the 40-section spec (architecture, policies, CLI/SDK surface, failure/security models, test plan, demo script). Build exactly this. |
| 3 | `03-AGENTS.md` | **Non-negotiable build rules** (zero-mock, chain-gating, quantization, expiry, key separation…). Follow these or the code will silently break. |
| 4 | `04-BUILD-PLAN.md` | **Ordered task list with acceptance gates** and handoff notes. Start at the first unchecked box. |
| 5 | `05-SUBMISSION-GATE.md` | **Requirements matrix + pre-submission gate + final-output requirements.** Part B must be run at the END of the build and saved to `test/reports/submission-gate.md`; Part C defines `docs/FINAL.md`. |
| 5 | `raw-docs/` | **Official documentation, captured verbatim**: DreamDEX event-contracts dev pages (the SDK, recipes, market structure, addresses, gotchas), trading pages, operators/session keys, WebSocket + HTTP API, plus the FULL docs corpora of DreamDEX and Somnia as `.txt` (searchable). |
| 6 | `sdk-reference/` | The `@somnia-chain/markets-sdk` npm README (the complete API surface incl. live watches, React hooks, reactivity, native RPC), npm metadata, and the package's actual `addresses.ts` + `config.ts` source (baked deployment addresses, fixed-fee/gas defaults). |
| 7 | `bot-kit-reference/` | The official `somnia-chain/dreamdex-bot-kit`: README, its event-contracts doc (sharp edges + venue-id handling), its network config source (endpoint defaults), and `ec-maker` (the best existing EC maker strategy — your baseline to beat: it polls every 10s, quotes mid-of-book, has no genesis logic). |
| 8 | `live-evidence/` | `live-probe.ts` (known-good read-only connectivity script, already in `probe/` at repo root) + its **captured live output** against the real Somnia Shannon testnet on 2026-09-01: 14 live binary markets, on-chain status, tick/lot params, opening prices, BTC/ETH price feed. Run it anytime: `npx tsx probe/live-probe.ts` from repo root. |

## What already exists in the repo (do not redo)

- npm workspace root with `@somnia-chain/markets-sdk@0.29.0`, `viem`, `tsx`
  installed. Node ≥ 20, TypeScript ESM, run with `tsx` (no build step).
- `probe/live-probe.ts` — working read-only testnet probe (ground truth).
- `docs/` mirrors of files 01/02; `AGENTS.md` and `BUILD_PLAN.md` at repo root
  (same content as files 03/04 — keep them in sync).
- Empty `packages/core`, `test/` skeleton.

## The build, in one glance (details in 04-BUILD-PLAN.md)

1. **`packages/core` (`@tempo/core`)** — types, config (per-network endpoints/
   addresses from 01 §2), quant (tick/lot), fairValue (driftless diffusion
   P(close≥open) from price-feed spot vs on-chain opening price + realized σ
   + time remaining), risk engine, policies (GenesisMaker / TakerPolicy —
   pure functions, no network imports), journal (typed JSONL), TempoExchange
   wrapper over the markets SDK (all three tiers; read-only without key).
2. **`packages/engine` (`@tempo/engine`)** — the firm runtime: per-market state
   machine BIRTH→ANCHOR→GENESIS→REPRICE→ENDGAME→LOCK→SETTLE→CLAIM→ROLL,
   live watches (poll fallback), execution via core, DRY_RUN mode, HTTP+SSE
   server.
3. **`packages/cli`** — `tempo doctor|markets|watch|book|agents|firm|trade|
   positions|claims|activity|verify|settlements|faucet` (thin shell over core).
4. **`test/`** — unit (offline, vitest), sdk/integration (live read-only),
   contract (real txs: faucet→mintSet→post-only→cancel→IOC→redeem, hashes
   recorded), failure, economic, e2e, cli. Real evidence only — never
   fabricate a hash or a result.
5. **`packages/web`** — single-screen dashboard (no page scroll), SSE-fed:
   venue pulse, book + fair-value band, firm roster, activity tape,
   settlements with oracle-explorer links. Provenance on every number.
6. **Finish per `05-SUBMISSION-GATE.md`**: run the pre-submission gate, write
   `test/reports/submission-gate.md`, and produce `docs/FINAL.md` (the
   40-section output refreshed with real evidence).

## Critical facts you cannot get wrong (all verified — details in 01/03)

- **Event-contract developer surface = `@somnia-chain/markets-sdk`** (HTTP API
  is spot-only). Constructor: `new SomniaMarkets({ indexerUrl, chain, wsRpcUrl,
  addresses, privateKey?, priceFeed? })`. Use `SOMNIA_TESTNET_ADDRESSES` /
  `SOMNIA_MAINNET_ADDRESSES` exports. Unified tier = trading by symbol in human
  units; `client.*` = on-chain truth; `trader.*` = redeem/faucet/raw writes.
- **Testnet endpoints**: indexer `https://dev.smk.somnia.host/v1/graphql`,
  RPC `https://api.infra.testnet.somnia.network`, WS
  `wss://api.infra.testnet.somnia.network/ws`, chain 50312, price feed
  `https://price-feed.dev.oracle.somnia.host/v1/graphql` (quote `USDC`).
  Mainnet: `prd.smk.somnia.host`, chain 5031.
- **Gate every write** on `client.getMarketOnchain(id).status === 1`. Check
  receipts at `(order.info as PlaceOrderResult).receipt` as well.
- **Tick/lot**: testnet `1000n` (0.001 on 6-dec tUSDC); mainnet `1e15` (18-dec
  USDso). Read via `getBinaryBookParams(pool)` — never hardcode.
- **One book, two sides** (Down = 1 − Up); mint-a-pair = two opposite buys
  cross with no seller → two-sided quote with **zero inventory**.
- **Order expiry mandatory** (ns, ≤ market expiry, 0 reverts) — dead-man's
  switch. IOC for takers, post-only for makers (catch `PostOnlyWouldCross` →
  re-quote).
- **Claims**: settled markets are only in
  `client.listBinaryMarkets({ status: "Finalized" })`; redeem via
  `trader.redeem` with explicit outcome index; voided → both sides at 0.5.
- **Opening prices** (`getOpeningPrices`) scale as price×100 on testnet —
  validate against the price feed at runtime.
- **Key state by marketId/symbol, never pool address** (pools recycle).
- **Two agents = two keys** (self-match blocked; nonce races). No key = honest
  read-only mode.
- **Zero mocked values. Ever.** Unavailable ⇒ show `UNAVAILABLE`/`PENDING`.

## Definition of done

A judge can: clone → `npm install` → `cp .env.example .env` → `npm run faucet`
→ `npm test` (offline suites green) → run live scripts (real hashes in
`test/reports/`) → `npm run firm` (DRY_RUN default) → `npm run web` → watch
windows be born liquid, agents trade, settlement pay out — every decision
journaled with its inputs and tx hash. `AGENTS.md` rules all hold.
