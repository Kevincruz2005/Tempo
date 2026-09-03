# TEMPO — The Autonomous Opening Auction for DreamDEX Event Contracts

## Executive Summary

DreamDEX creates a brand-new prediction market every minute — and every one of them is **born dead**: an empty order book, no bids, no asks, no price, until two opposite traders happen to collide. We verified this on-chain: finalized windows with literally zero trades.

**TEMPO is the missing piece of market structure: an autonomous opening auction.** A firm of two independent AI agents — **GENESIS** (the liquidity genesis maker) and **VECTOR** (the adversarial taker) — attends the birth of every Event Contract window, anchors it with a two-sided quote computed from the official oracle price feed against the window's **on-chain opening price**, re-prices it reactively as the market breathes, manages the endgame as expiry approaches, observes settlement, claims winnings, and rolls to the successor window. Forever. No human, no keeper, no polling.

The result: on Somnia's ~100 ms blocks, a rolling series of ephemeral windows becomes **one continuous, always-liquid market** — and every decision the firm makes is journaled before it acts and scored against on-chain settlement truth after the fact (current Brier score: **0.072**). Not claimed intelligence — **verifiable machine intelligence**.

---

## The Problem: Markets Are Born Dead

Every DreamDEX Event Contract window (BTC/ETH Up/Down over 1m–24h) deploys with:

- An **empty CLOB** — no resting liquidity of any kind
- A published **on-chain opening price** (the strike) and a hard expiry
- No one whose job it is to make it tradeable

**Live-verified evidence:** querying the venue's finalized windows returns row after row of `tradeCount: 0` — markets that existed for their full lifetime and never had a price. The venue's own bot kit ships makers that quote the *mid of an existing book* (falling back to 0.5 at birth) on a 10-second poll. Nobody anchors the birth, because no human can economically staff a market that dies in 15 minutes — let alone one that dies in 60 seconds.

Exchanges solved this centuries ago with the **opening auction**. DreamDEX's windows don't have one. That is the gap TEMPO fills.

## The Solution: Liquidity Genesis, End to End

```
BIRTH      the window deploys → discovered the block it lands (chain-log live tail)
ANCHOR     fair value = Φ( ln(spot / strike) / (σ√t) ) from the OFFICIAL price feed
           vs the ON-CHAIN opening price — computed BEFORE any book exists
GENESIS    two-sided quote with ZERO inventory: resting Buy Up at p−δ +
           Buy Down at (1−p)−δ — the venue's mint-a-pair path makes this a
           complete market with no capital locked in inventory
REPRICE    event-driven: fills, price ticks, and time decay trigger cancel/replace
           in the same block era (no polling loop); inventory skew bends the mid
ENDGAME    spread tightens with √(time), quotes skew toward certainty as delta expands
SETTLE     the chain resolves the window via Somnia on-chain reactivity — no keeper
CLAIM      winnings redeemed on-chain (void-aware: both sides at 0.5 if voided)
ROLL       successor window appears → back to BIRTH
```

**Two agents, two minds, one market.** GENESIS and VECTOR run on separate keys, separate capital, and genuinely different policies over the same real inputs — so they *disagree*: GENESIS quotes where VECTOR's own fair-value model sees edge, VECTOR takes IOC against GENESIS's quotes, and both are gated by a shared `RiskEngine` enforcing per-window inventory caps, per-order collateral caps, firm capital limits, tick/lot grid alignment, and expiry headroom on **every** order before it is ever signed.

## Why Somnia (Load-Bearing, Not a Deployment Target)

- **~100 ms blocks, sub-second finality, negligible gas** — continuous re-quoting across ~14 concurrent windows is *economical*. On Ethereum the gas per cancel/replace would exceed the edge per quote.
- **Off-chain reactivity (`somnia_watch`)** — book and fill events arrive with same-block read results attached; the quoter reacts in the block era, not on a timer.
- **One-round-trip writes** — SDK writes confirm via `realtime_sendRawTransaction` (fixed fees, tracked nonce): send + receipt in a single round trip.
- **Keeperless settlement** — DreamDEX resolves windows by delivering oracle answers to market contracts *through Somnia's on-chain reactivity*. TEMPO's settlement observation is native, not bolted on.
- Remove Somnia and TEMPO loses its reaction speed, its economics, and its settlement rail. This is not a generic EVM bot.

**Why DreamDEX Event Contracts (load-bearing):** the mechanism *is* the product — the on-chain opening price as anchor, mint-a-pair zero-inventory quoting, mandatory order expiry as a built-in dead-man's switch for autonomous agents, the `Finalized` claim flow, oracle-settled rolling windows. Delete Event Contracts and there is no birth to attend.

## Verifiable Machine Intelligence

Most "AI trading" claims cannot be checked. Ours can:

1. **Every estimate is journaled before action** — spot, strike, σ, time, and the computed probability, with an explicit `AI ESTIMATE` label (chain reads are labeled `CHAIN FACT`).
2. **Every settlement is an on-chain fact.**
3. **The system grades itself:** each resolved market scores the appraiser's last pre-expiry estimate against the actual winning outcome.
   - **Brier score: 0.0723** (0 = perfect, 0.25 = coin-flip confidence)
   - **Directional accuracy: 100%** on scored markets
4. **The firm learns within bounds:** a calibration loop consumes scored outcomes, adjusts exactly two pricing parameters (σ multiplier, taker edge) clamped to [0.5×, 2×] of operator-set defaults, one adjustment per ≥25-market epoch — every adjustment journaled with its reason. Deterministic, auditable self-improvement. **No LLM in the hot path** — at 100 ms blocks there is no room for one, and an LLM pricing "BTC above its open in 8 minutes" adds latency, not accuracy.

---

## Live Testnet Execution (Zero Mocked State)

100% on Somnia Shannon testnet (chain 50312). **31/31 unique transaction hashes from our journal independently verified successful on-chain; 0 failures.** Every link below is a real explorer transaction:

**The funded lifecycle of market `0x…010fad` (2026-09-02):**

| Step | Agent | Tx |
|---|---|---|
| Testnet collateral minted | GENESIS | [`0x7a78a4…`](https://shannon-explorer.somnia.network/tx/0x7a78a4f4ca13cc59c94ee6d1a78c03bead20112ef71ae1adcd1f3850b4f6561a) |
| Testnet collateral minted | VECTOR | [`0xb51c35…`](https://shannon-explorer.somnia.network/tx/0xb51c35c96f3bcd8b061c4f956b946d2177d1276f7ca1c9849ee16aeb160375b1) |
| Complete set minted (inventory) | GENESIS | [`0xe4cfac…`](https://shannon-explorer.somnia.network/tx/0xe4cfacbcccf7100a16bdec6d91b77b7a36d1137125cd6f072115b05c14c31710) |
| Post-only anchor quote resting | GENESIS | [`0x61df88…`](https://shannon-explorer.somnia.network/tx/0x61df8841b3fe0b505415ce28f983c888f24c8bce712d32003cdce6416af9e0b7) |
| Requote — stale order cancelled | GENESIS | [`0xec1a64…`](https://shannon-explorer.somnia.network/tx/0xec1a645007bc031ddf1ea16e5d21b1bdf6291f634dee9c03955c37f1506028ed) |
| Post-only sell (inventory side) | GENESIS | [`0x55343b…`](https://shannon-explorer.somnia.network/tx/0x55343bb33a3683fd4077f28e724e931b7d9977b7e0d812252369a8f05268ac23) |
| **IOC take — real fill** | VECTOR | [`0x3d2cc4…`](https://shannon-explorer.somnia.network/tx/0x3d2cc41de74db30eb8811609cdee105e9657a7dce2b463236b3a5618a6b26079) |

…continuing through settlement observation, on-chain redemption of winnings, and the automatic roll to the successor window (full ledger with block numbers and timestamps: [`test/reports/full-onchain-mode.md`](https://github.com/Kevincruz2005/Tempo/blob/main/test/reports/full-onchain-mode.md)).

**24 hours of live firm operation (from `tempo report`, all journal-derived):**

- **369 windows** born and observed live (BTC 192 / ETH 177)
- **6,274 decisions** journaled with full inputs
- **168 real order sends → 120 unique transaction hashes**
- **10 fills, 3 settlements claimed** on-chain
- **1 risk-engine rejection** (inventory cap bound — the safety system working)
- **996 upstream errors absorbed** (indexer timeouts) — caught, journaled, ridden through; the firm never crashed

**Proving the failure model:** post-only quotes that would cross revert with `PostOnlyWouldCross` — caught and treated as "the book moved into us," triggering a requote. Orders on just-locked markets are chain-gated before signing (`getMarketOnchain().status === 1`) because the indexer lags seconds behind the chain. Every order carries mandatory expiry capped at the window's own — a crashed bot's orders age off the book by themselves.

## Provenance & The Zero-Mock Discipline

- **`MOCKED VALUES = 0`** — no fabricated prices, probabilities, balances, hashes, volumes, or analytics anywhere in the production path. Audited: [`test/reports/zero-mock-audit.md`](https://github.com/Kevincruz2005/Tempo/blob/main/test/reports/zero-mock-audit.md)
- Every displayed value carries a **provenance tag** (`price-feed` / `on-chain` / `policy` / `derived`) naming its exact source endpoint or contract
- Unavailable values render honestly: `UNAVAILABLE`, `NO DATA`, `PENDING` — never faked completeness
- **`tempo verify`** replays the journal and cross-checks **every transaction hash against the chain via `getTransactionReceipt`** — anyone can independently confirm our evidence in one command

---

## Developer Surface: SDK, CLI, MCP, API

The primitive is reusable, not a demo shell:

- **`@tempo/core` — typed Node SDK** (v0.2.0, strict TypeScript, CycloneDX SBOM + SHA256 checksums + clean-environment consumer verification): config, exchange wrapper over all three tiers of `@somnia-chain/markets-sdk` (unified / client / trader), fair-value engine, risk engine, policies, journal, ledger, calibration, report generation
- **`tempo` CLI — 15 real commands**: `doctor · markets · book · watch · agents · positions · firm simulate|start · trade · claims · settlements · activity · verify · report · calibrate · faucet`
- **MCP server — 12 tools** for external AI agents: 10 read tools (`discover_markets`, `inspect_event_contract`, `get_live_book`, `get_fair_value`, `get_settlement`, `verify_receipt`, …), an always-dry-run `simulate_trade`, and an opt-in `place_order` gated behind `TEMPO_MCP_WRITES=true` that still routes through the same RiskEngine — schema-validated, journaled, zero key exposure
- **Single-screen web observatory** (`npm run firm` → localhost:7333): live windows, materialized books, fair-value band, firm roster, activity tape with real tx hashes, settlement feed with oracle-explorer audit links, SSE live stream — plus **Connect Wallet** (EIP-1193 provider, pre-sign summary before any signature, read-only address watching)
- **`/health` + `/ready`** service endpoints (rate-limited, same-origin enforced, zero secret leakage)
- **Optional LLM narration** for the firm report — stats-only prompt, output labeled `AI NARRATIVE`, graceful no-key fallback; the deterministic report is complete without it

CLI, web, and MCP all sit on the same core — one implementation of the primitive, three surfaces.

## Engineering Evidence

- **2,107 automated tests passing** (17 files) — including a 2,048-case economic/decimal invariant matrix, security boundaries, failure paths, CLI matrix
- **`npm audit`: 0 vulnerabilities** · strict `tsc` clean across 4 packages · SBOM + checksums in `release/`
- **Reproducible from a clean clone**: `npm install → cp .env.example .env → npm test → npm run firm` — no hidden manual state, dry-run by default, keys never in the repo
- Full evidence index: [`test/reports/`](https://github.com/Kevincruz2005/Tempo/tree/main/test/reports)

## Architecture

```
                    ┌──────────────────────────────┐
   Oracle price feed│         @tempo/core          │  On-chain truth (Somnia Shannon 50312)
   (official, live)─┤  fair value · risk · policies ├─ BinaryMarketsModule · pools · ERC-6909
   Chain logs ──────┤  exchange (3 SDK tiers)       │  oracle-settled windows
   (live tail)      │  journal · ledger · calibration│
                    └──────┬───────────────┬───────┘
                    ┌──────┴──────┐  ┌─────┴──────┐
                    │ @tempo/engine│  │  tempo CLI  │
                    │ GENESIS·VECTOR│  │ 15 commands │
                    │ reactive firm │  └─────────────┘
                    │ + SSE server  │  ┌─────────────┐
                    └──────┬────────┘  │ @tempo/mcp  │ ← external AI agents
                    ┌──────┴──────┐    └─────────────┘
                    │ web observatory (single screen, wallet, docs) │
                    └─────────────┘
```

## What's Next

- **Mainnet is a config switch** (`TEMPO_NETWORK=mainnet`) — DreamDEX's core contracts hold identical CREATE3 addresses across networks; decimals, venue IDs, and tick/lot grids are all derived from the chain at runtime
- **Anchor feed**: publish every genesis anchor as a public, auditable record via Somnia Data Streams — turning TEMPO's anchoring into queryable market infrastructure other agents can build on
- **Operator-scoped browser trading** via DreamDEX's session-key model
- A team of specialized agents (hedger, laddered endgame quoter) competing within one risk envelope

## Live Links

- **GitHub:** https://github.com/Kevincruz2005/Tempo
- **Demo video (2–3 min):** [REPLACE WITH FINAL VIDEO LINK — re-cut per requirement before submitting]
- **Dashboard:** `npm run firm` → http://localhost:7333 (runs from the repo; live testnet data)
- **On-chain evidence:** [`test/reports/full-onchain-mode.md`](https://github.com/Kevincruz2005/Tempo/blob/main/test/reports/full-onchain-mode.md) · verify any hash yourself: `tempo verify`
- **Firm report (real journal aggregation):** [`test/reports/firm-report-20260902.md`](https://github.com/Kevincruz2005/Tempo/blob/main/test/reports/firm-report-20260902.md)

---

*Every number in this submission is computed from the journal or read from the chain. Nothing is simulated, projected, or mocked. Run `tempo verify` and check us.*
