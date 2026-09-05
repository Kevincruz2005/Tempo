# TEMPO — The Autonomous Opening Auction for DreamDEX Event Contracts

## Executive Summary

DreamDEX creates a brand-new prediction market every minute — and every one of them is **born dead**: an empty order book, no bids, no asks, no price, until two opposite traders happen to collide. We verified this on-chain: finalized windows with literally zero trades.

**TEMPO is the missing piece of market structure: an autonomous opening auction.** A firm of two independent trading agents — **GENESIS** (the liquidity genesis maker) and **VECTOR** (the adversarial taker) — attends the birth of every Event Contract window, anchors it with a two-sided quote computed from the official oracle price feed against the window's **on-chain opening price**, re-prices it reactively as the market breathes, manages the endgame as expiry approaches, observes settlement, claims winnings, and rolls to the successor window. No human market maker or external keeper is required; market updates react to live events while bounded scheduled tasks handle discovery, expiry, claims, retries, and health checks.

The result: on Somnia's ~100 ms blocks, a rolling series of ephemeral windows becomes **one continuous, always-liquid market** — and every decision the firm makes is journaled before it acts and scored against on-chain settlement truth after the fact. The system's estimates and decisions are transparent, bounded, and verifiable.

---

## The Problem: Markets Are Born Dead

Every DreamDEX Event Contract window (BTC/ETH Up/Down over 1m–24h) deploys with:

- An **empty CLOB** — no resting liquidity of any kind
- A published **on-chain opening price** (the strike) and a hard expiry
- No one whose job it is to make it tradeable

**Live-verified evidence:** querying the venue's finalized windows returns row after row of `tradeCount: 0` — markets that existed for their full lifetime and never had a price. The venue's own bot kit ships makers that quote the *mid of an existing book* (falling back to 0.5 at birth) on a 10-second poll. Nobody anchors the birth, because no human can economically staff a market that dies in 15 minutes — let alone one that dies in 60 seconds.

Exchanges solved this centuries ago with the **opening auction**. DreamDEX's windows don't have one. That is the gap TEMPO fills.

**The problem, quantified:** at 2026-09-05T16:47:03.779Z, **10 of the latest 12 finalized windows had `tradeCount: 0`**. The other two had 2 and 3 trades. This is a dated chain/indexer snapshot—not an extrapolation—and is reproducible from [`test/reports/business-impact-20260905.md`](test/reports/business-impact-20260905.md).

**Why this is not a bot:** a market-making bot profits from an existing market. TEMPO creates the market—there is no book to make until it anchors one. Liquidity Genesis for ephemeral markets is a missing venue function, not merely a strategy layered on top.

## The Solution: Liquidity Genesis, End to End

```
BIRTH      the window deploys → discovered the block it lands (chain-log live tail)
ANCHOR     fair value = Φ( ln(spot / strike) / (σ√t) ) from the OFFICIAL price feed
           vs the ON-CHAIN opening price — computed BEFORE any book exists
GENESIS    two-sided quote with ZERO inventory: resting Buy Up at p−δ +
           Buy Down at (1−p)−δ — the venue's mint-a-pair path makes this a
           complete market with no capital locked in inventory
REPRICE    event-driven: fills, price ticks, and time decay trigger cancel/replace
           in the same block era (live-event reaction); inventory skew bends the mid
ENDGAME    spread tightens with √(time), quotes skew toward certainty as delta expands
SETTLE     the chain resolves the window via Somnia on-chain reactivity — no keeper
CLAIM      winnings redeemed on-chain (void-aware: both sides at 0.5 if voided)
ROLL       successor window appears → back to BIRTH
```

**Two agents, two minds, one market.** GENESIS and VECTOR run on separate keys, separate capital, and genuinely different policies over the same real inputs — so they *disagree*: GENESIS quotes where VECTOR's own real-time fair-value engine sees edge, VECTOR takes IOC against GENESIS's quotes, and both are gated by a shared `RiskEngine` enforcing per-window inventory caps, per-order collateral caps, firm capital limits, tick/lot grid alignment, and expiry headroom on **every** order before it is ever signed.

## Why Somnia (Load-Bearing, Not a Deployment Target)

- **~100 ms blocks, sub-second finality, negligible gas** — continuous re-quoting across ~14 concurrent windows is *economical*. On Ethereum the gas per cancel/replace would exceed the edge per quote.
- **Off-chain reactivity (`somnia_watch`)** — book and fill events arrive with same-block read results attached; the quoter reacts in the block era, not on a timer.
- **One-round-trip writes** — SDK writes confirm via `realtime_sendRawTransaction` (fixed fees, tracked nonce): send + receipt in a single round trip.
- **Keeperless settlement** — DreamDEX resolves windows by delivering oracle answers to market contracts *through Somnia's on-chain reactivity*. TEMPO's settlement observation is native, not bolted on.
- Remove Somnia and TEMPO loses its reaction speed, its economics, and its settlement rail. This is not a generic EVM bot.

### Somnia Ecosystem Stack & Resources Leveraged

| Category | Resource / Component | How TEMPO Uses It |
|:---|:---|:---|
| **L1 Blockchain** | **Somnia L1 (Shannon 50312 & Mainnet 5031)** | Ultra-high throughput (~100ms blocks), sub-second finality, and negligible execution gas for high-frequency quoting. |
| **RPC & Node APIs** | **`https://api.infra.testnet.somnia.network`** | Primary JSON-RPC node infrastructure for state inspection, signer balances, order broadcasting, and health probing. |
| **Reactivity Primitives** | **`somnia_watch` & `realtime_sendRawTransaction`** | Streaming log tailing for microsecond fill detection; single round-trip write/receipt validation avoiding pending-state limbo. |
| **Protocol Contracts** | **DreamDEX Suite (CREATE3 Deployed)** | Direct on-chain interaction with `BinaryMarketsModule`, `MarketsCore` (CLOB), `BinarySettlement`, `OutcomeToken6909`, and `CollateralRouter`. |
| **Oracle Layer** | **`OracleHub` & Somnia Price Feeds** | Official Somnia spot price feeds (ETH/USD, BTC/USD) and oracle hub for fair-value driftless diffusion ($\Phi$) and settlement scoring. |
| **Protocol SDK** | **`@somnia-chain/markets-sdk`** | Type-safe contract interfaces, order encoding, balance checks, and multi-tier exchange abstraction inside `TempoExchange`. |
| **Tokens & Collateral** | **`STT` (Native) & `tUSDC` (Collateral)** | Somnia native token (`STT`) for gas execution; testnet ERC-20 collateral (`0x70a8...25d8E`) for pair-minting and order settlement. |
| **Data & Explorer** | **Somnia Shannon Explorer & Envio Indexer** | Ledger verification (`shannon-explorer.somnia.network`) and indexed window discovery with direct RPC failover. |

**Why DreamDEX Event Contracts (load-bearing):** the mechanism *is* the product — the on-chain opening price as anchor, mint-a-pair zero-inventory quoting, mandatory order expiry as a built-in dead-man's switch for autonomous agents, the `Finalized` claim flow, oracle-settled rolling windows. Delete Event Contracts and there is no birth to attend.

## Verifiable Trading Intelligence

Most trading-system claims cannot be checked. TEMPO's model-based estimates and execution evidence can:

1. **Every estimate is journaled before action** — spot, strike, σ, time, and the computed probability, with an explicit `MODEL ESTIMATE` label (chain reads are labeled `CHAIN FACT`).
2. **Every settlement is an on-chain fact.**
3. **The system grades itself:** each resolved market scores the real-time fair-value engine's last pre-expiry estimate against the actual winning outcome.
   - **Brier score: 0.0561 across 18 scored markets** (0 = perfect, 0.25 = coin-flip confidence)
4. **The firm learns within bounds (Multi-Tiered AI Architecture):** a calibration loop consumes scored outcomes, adjusting pricing parameters (σ multiplier, taker edge) clamped to [0.5×, 2×] of operator defaults per ≥25-market epoch. Hot-path quoting relies on microsecond closed-form math to eliminate toxic execution latency, while generative LLMs power cold-path narrative reports, deep performance audits, and autonomous agent coordination via MCP.

---

## Live Testnet Execution (Zero Mocked State)

All recorded transactions below ran on Somnia Shannon testnet (chain 50312). **31/31 unique transaction hashes from the funded validation sample were independently verified successful on-chain; 0 failures. Across the full 24-hour operation, the firm recorded 120 unique transaction hashes.** Every link below is a real explorer transaction:

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
The system journaled **996 operational errors—including market-discovery and settlement-feed failures—and absorbed them without crashing the firm.**

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
- **`tempo` CLI — 15 command families with 16 documented subcommands**: `doctor · markets · book · watch · agents · positions · firm simulate · firm start · trade · claims · settlements · activity · verify · report · calibrate · faucet`
- **MCP server — 12 tools** for external AI agents: 10 read tools (`discover_markets`, `inspect_event_contract`, `get_live_book`, `get_fair_value`, `get_settlement`, `verify_receipt`, …), an always-dry-run `simulate_trade`, and an opt-in `place_order` gated behind `TEMPO_MCP_WRITES=true` that still routes through the same RiskEngine — schema-validated, journaled, zero key exposure
- **Multipage web observatory** (`npm run firm` → localhost:7333): direct Observatory, Markets, History, Docs, and Protocol routes; a one-monitor live surface with bounded panel scrolling; materialized books, fair-value band, firm roster, activity tape with real tx hashes, settlement feed with oracle-explorer audit links, SSE live stream — plus **Connect Wallet** (EIP-1193 provider, pre-sign summary before any signature, read-only address watching)

### Public demo runbook

Run `npm run public-demo` after starting the firm to expose the local observatory through an operator-provided Cloudflare Quick Tunnel. The repository does not claim a permanent public URL, external fills, or wallet signatures without attributable evidence.
- **First-visit orientation**: a dismissible, locally remembered guide explains Liquidity Genesis, The Anchoring, provenance, panel navigation, and the wallet path before a judge enters the dense live surface
- **Firm Intelligence bar**: journal-derived Brier score, directional accuracy, births, fills, matched notional, live two-sided coverage, transaction hashes, the venue's 0% fee policy, and zero-mock status are visible without scrolling
- **`/health` + `/ready`** service endpoints (rate-limited, same-origin enforced, zero secret leakage)
- **Autonomous LLM narration**: Generative model integration for executive firm reporting (`tempo report --llm`), synthesizing verified journal records into strategic natural language audit narratives (`AI NARRATIVE`) with deterministic statistical foundations

CLI, web, and MCP all sit on the same core — one implementation of the primitive, three surfaces.

## Business & Ecosystem Impact

The 2026-09-05 evidence snapshot contains **2,381 journaled market births, 100 fills, and 1,255.625 tUSDC of matched quote notional**. At the live coverage checkpoint, 10 windows were trading, 8 were in TEMPO-managed cadences, and 6 had a materialized two-sided managed book (3 BTC and 3 ETH): **60% of all active windows and 75% of managed active windows**.

DreamDEX currently sets maker, taker, and settlement fees to **0%**, so TEMPO does not claim invented protocol fee revenue. The ecosystem impact is immediately tradable books and matched activity without taxing users. The sustainable economic path is:

1. GENESIS targets spread capture, settlement value, and venue maker yield where applicable.
2. VECTOR targets bounded edge when its independent estimate disagrees with the touch.
3. Somnia's low transaction cost and a single autonomous Node.js process keep operation economical.
4. More usable windows attract wallet traders and external agents; more activity strengthens DreamDEX's utility and creates more assets and cadences for TEMPO to cover.
5. `@tempo/core` and the MCP server are MIT licensed, allowing other builders to extend the primitive.

Historical fills did not retain enough counterparty identity to prove external adoption. New runtime fills now journal maker, taker, counterparty, and `FIRM`/`EXTERNAL` classification. A “Proven by External Traders” claim will be added only after an attributed fill and receipt are captured; no external demand is fabricated here.

## Engineering Evidence

- **2,115 automated tests passing** (18 files) — including a 2,048-case economic/decimal invariant matrix, security boundaries, failure paths, and the CLI matrix
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
                    │ GENESIS·VECTOR│  │ 15 families │
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
- **Current evaluation report:** [`test/reports/gemini-report.md`](https://github.com/Kevincruz2005/Tempo/blob/main/test/reports/gemini-report.md)
- **Historical firm report (2026-09-02):** [`test/reports/firm-report-20260902.md`](https://github.com/Kevincruz2005/Tempo/blob/main/test/reports/firm-report-20260902.md)

---

*Every number in this submission is computed from the journal or read from the chain. Nothing is simulated, projected, or mocked. Run `tempo verify` and check us.*
