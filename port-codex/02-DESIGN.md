# TEMPO — Design Document

**TEMPO: the autonomous opening auction for DreamDEX Event Contracts.**

Every 15 minutes — on the testnet deployment, every single minute — a DreamDEX
event-contract window is born with an empty order book, an on-chain opening
price, and a hard expiry. TEMPO is a firm of autonomous agents that shows up at
every birth, underwrites the opening with real two-sided liquidity anchored to
the oracle's live spot feed, re-prices continuously through the window's life,
manages the endgame, claims settlement, and rolls to the successor — no human,
no keeper, no polling. The venue's missing opening auction, run by machines,
made possible by Somnia.

---

## Part I — Ideation

### 1. The reasoning chain (fixed order, per the operating principle)

```text
WHY SOMNIA EXISTS
  Real-time fully-on-chain apps: ~100 ms blocks, sub-second finality, 1M+ TPS
  design, compiled EVM, IceDB. Plus three no-other-EVM capabilities:
  on-chain reactivity, off-chain reactivity (somnia_watch + same-block
  eth_call results), native somnia_* RPC / realtime_sendRawTransaction.
        ↓
UNIQUE ECOSYSTEM CAPABILITY
  Continuous, reactive, cheap on-chain interaction at machine speed.
        ↓
DREAMDEX CAPABILITY
  A fully on-chain CLOB with zero fees, mint-a-pair zero-inventory two-sided
  quoting, on-chain opening prices, oracle-settled windows that respawn
  automatically, mandatory order expiry, proximity-weighted maker yield,
  operator session keys.
        ↓
EVENT CONTRACT PRIMITIVE
  Ephemeral binary markets (15m/1h/…): born with an empty book + a strike,
  die on schedule, settle without a keeper, leave a full public tape.
        ↓
AI / AGENT CAPABILITY
  Fair-value synthesis from real inputs (spot feed vs strike, realized vol,
  time decay, order-flow imbalance) + risk decisions across ~14 concurrent
  windows at machine speed.
        ↓
NEW ECONOMIC BEHAVIOR
  Liquidity genesis for ephemeral markets: every window opens liquid, priced
  by an autonomous firm, traded by other participants, settled and claimed
  on-chain. The market series becomes continuous.
        ↓
PRODUCT
  TEMPO — agents + CLI + SDK + web observability.
```

### 2. The problem, verified live

**[LIVE-VERIFIED]** Recently finalized 1-minute windows on the testnet venue
show `tradeCount 0` and `cumulativeQuoteVolume 0`. A brand-new window's book is
empty until two opposite-side buyers happen to arrive — the mint-a-pair path
requires *someone* to seed the touch. Every bot-kit maker strategy quotes
around the mid of an *existing* book (fallback 0.5) on a 10-second poll.
Between window birth and first trade, the venue has no market. That is the
opening-auction gap — the exact gap a machine should close.

### 3. Candidate primitives (10–15, fundamentally different economic problems)

| # | Name | Primitive | Economic problem attacked | One-line mechanism |
|---|------|-----------|---------------------------|--------------------|
| 1 | **TEMPO** | Liquidity genesis for ephemeral markets | Empty books at window birth; missing opening auction | Autonomous firm quotes two-sided at genesis anchored to oracle spot vs on-chain strike; carries each window through expiry/settlement/claim/roll |
| 2 | Prophet Arena | Directional alpha bot | Mispriced probabilities | LLM/statistical signal takes directional positions |
| 3 | Volatility Harvest | Machine-native theta harvesting on binaries | Time-decay mispricing near expiry | Sell overpriced convexity in final minutes via diffusion fair value |
| 4 | Event Composer | Event-dependency bundles | No way to express multi-window views | Bundle N event contracts into synthetic payoffs (streaks, butterflies), price joint distribution |
| 5 | Yield Sniper | Proximity-yield farming | Maker yield subsidy capture | Re-quote to stay nearest mid, farm collateral yield |
| 6 | Tail Desk | Autonomous rolling protection underwriting | BTC holders need crash insurance | Continuously underwrite Down legs as capped-risk insurance, price off realized vol |
| 7 | Forecaster Bazaar | Prediction-performance reputation economy | No accountability for agent forecasts | Agents publish estimates before trading; on-chain Brier scoring; stake on forecaster accuracy |
| 8 | Oracle Mirror | Settlement-feed alpha | Book lags the settlement oracle's own view | Watch oracle price sources; trade when implied probability diverges from the pipeline median |
| 9 | Cross-Window Arb | Consistency enforcement across correlated series | 1m vs 15m vs 1h series must cohere | Detect implied-correlation violations, trade baskets |
| 10 | Auction Curator | Batch opening auctions | Price discovery at birth is ad-hoc | Collect early intent, run an on-chain batch auction per window birth |
| 11 | Dream Vault | Capital-allocation vault over agents | Passive capital wants agent exposure | ERC-4626-style vault routing to agent strategies *(already taken by a public hackathon repo)* |
| 12 | LevelField | Information-asymmetry risk analytics | Traders can't see who knows what | Structural asymmetry metrics on fills *(already taken by a public hackathon repo)* |
| 13 | Void Sentinel | Settlement insurance / audit market | Voided markets strand expectations | Audit resolutions against oracle pipeline; dispute/void backstop service |
| 14 | Flow Tape | Machine-native market-data product | Agents need clean tapes | Normalize chain-log flow into a subscribable tape SDK |
| 15 | Keeper Collective | Decentralized settlement backstop | pokeOracle/voidExpired needs watchers | Bonded watchers earn fees for backstopping settlement |

### 4. Scoring matrix (1–10 per criterion; weights per the master prompt)

| # | Novel primitive 20% | EC necessity 15% | DreamDEX depth 10% | Somnia fit 10% | AI necessity 10% | Demo impact 10% | Feasibility 10% | SDK utilization 5% | Startup 5% | Memorability 5% | **Weighted** |
|---|----|----|----|----|----|----|----|----|----|----|----------|
| 1 TEMPO | 8 | 10 | 10 | 10 | 8 | 9 | 8 | 10 | 8 | 9 | **9.00** |
| 2 Prophet Arena | 4 | 6 | 5 | 3 | 7 | 5 | 7 | 5 | 5 | 4 | 5.15 |
| 3 Vol Harvest | 7 | 8 | 6 | 5 | 7 | 6 | 6 | 6 | 6 | 5 | 6.35 |
| 4 Event Composer | 9 | 9 | 6 | 4 | 7 | 6 | 3 | 5 | 7 | 6 | 6.55 |
| 5 Yield Sniper | 5 | 6 | 8 | 6 | 5 | 5 | 7 | 7 | 5 | 4 | 5.75 |
| 6 Tail Desk | 7 | 8 | 6 | 4 | 6 | 6 | 6 | 6 | 7 | 5 | 6.30 |
| 7 Forecaster Bazaar | 9 | 5 | 4 | 5 | 8 | 5 | 3 | 4 | 8 | 6 | 5.95 |
| 8 Oracle Mirror | 8 | 7 | 7 | 7 | 7 | 6 | 4 | 7 | 6 | 6 | 6.55 |
| 9 Cross-Window Arb | 7 | 8 | 6 | 5 | 6 | 5 | 4 | 6 | 5 | 4 | 5.85 |
| 10 Auction Curator | 8 | 9 | 5 | 6 | 6 | 6 | 3 | 5 | 7 | 6 | 6.15 |
| 11 Dream Vault | 5 | 7 | 6 | 4 | 5 | 5 | 5 | 6 | 7 | 4 | 5.35 |
| 12 LevelField | 6 | 7 | 5 | 4 | 7 | 4 | 6 | 5 | 5 | 4 | 5.40 |
| 13 Void Sentinel | 6 | 9 | 6 | 7 | 5 | 4 | 5 | 7 | 4 | 4 | 5.90 |
| 14 Flow Tape | 5 | 6 | 7 | 7 | 4 | 4 | 6 | 8 | 6 | 3 | 5.55 |
| 15 Keeper Collective | 6 | 9 | 5 | 8 | 4 | 4 | 5 | 7 | 4 | 4 | 5.90 |

**Qualitative elimination.** 2/5/12/14 are trading-bot/analytics variants a UI
change would replicate (Replication Test fails). 4/10 need liquidity and
contract surface that a hackathon timeframe cannot safely add (feasibility).
7 needs its own reputation contract (scope). 8/13/15 depend on oracle internals
and low-frequency settlement events (weak demo). 11/12 collide with existing
public entries. 3/6/9 are strong strategies but single-role; their best
mechanics (endgame pricing, protection underwriting logic) are absorbed into
TEMPO's appraiser and endgame policy. **TEMPO wins** and is the only candidate
that passes every removal test (Part II, §6).

### 5. Ecosystem-utilization audit of the winner

TEMPO touches, by hand-verified surface: unified/client/trader tiers of the
markets SDK (all three, per the docs' explicit instruction), live watches +
discovery, the official price feed, Somnia reactivity, `realtime_sendRawTransaction`
writes (via SDK), on-chain status/order/balance reads, Finalized-status claim
flow, tick/lot grid quantization, mandatory expiry as dead-man's switch,
operator-key architecture, oracle-explorer provenance links, and the Bot Kit's
documented sharp edges re-encoded as executable policy tests. HTTP API + spot
WebSocket: justified non-use (no event-contract endpoints; EC books stream from
chain logs with strictly better fidelity). Data Streams + Somnia Agents
prototype: justified non-use (not load-bearing; documented in RECONNAISSANCE §3).

---

## Part II — The Winner (40-section output)

### 1. Project Name

**TEMPO** — agents `GENESIS` (maker) and `VECTOR` (taker).

### 2. One-Sentence Primitive

**An autonomous market firm that provides two-sided liquidity at the birth of
every DreamDEX event-contract window — anchored to the on-chain opening price
and the oracle's live spot feed — and carries each market through quote,
re-price, endgame, settlement, claim, and successor roll with zero human
intervention.**

### 3. Why This Exists

Somnia exists to make continuous on-chain markets real. DreamDEX built the CLOB
and the window mechanics — including mint-a-pair, which lets a two-sided quote
exist with zero inventory — but every window still opens empty: there is no
opening auction. Human market makers cannot economically staff a rolling series
of 15-minute/1-minute books (14 concurrent windows on testnet alone, ~70+
births/day on mainnet cadences) and cannot re-price continuously. This is a
gap only a machine can fill, and only this chain makes it viable.

### 4. Problem

New event-contract windows are born illiquid (**live-verified**: finalized 1m
markets with 0 trades). Traders arriving early face no touch; the venue's
proximity-weighted maker yield goes unclaimed; price discovery at birth is a
coin-flip fallback (0.5). Liquidity at genesis is the single most valuable and
least supplied service in this market structure.

### 5. New Behavior

- Every window opens with an anchored two-sided quote within seconds of birth.
- The quote is *derived*, not copied: fair value is computed from the oracle's
  live spot vs the on-chain opening price, realized volatility of the
  underlying feed, and time remaining.
- The book breathes: fills, price moves, and time decay trigger re-quotes
  reactively (same block era, no polling).
- The window's endgame is managed: quotes tighten and skew toward certainty as
  delta explodes; risk caps bind; flatten-or-hold is a policy decision.
- Settlement is observed, winnings are claimed on-chain, and the firm rolls to
  the successor window. Continuously. Forever.

### 6. Why Somnia

1. **Off-chain reactivity** (`somnia_watch` with same-block `eth_call`
   results): the quoter reacts to fills and book changes in the same block era
   — on any other EVM this is a polling loop with read races.
2. **~100 ms blocks + sub-second finality**: IOC taker loops and cancel/replace
   cycles resolve faster than a human can blink; event windows span thousands
   of blocks.
3. **`realtime_sendRawTransaction`** (used by the markets SDK for every write):
   send + confirm in one round trip, fixed fees, locally tracked nonce.
4. **Negligible gas**: quoting across 14 concurrent windows continuously is
   viable; on mainnet-Ethereum each cancel/replace would cost more than the
   edge.
5. **The venue itself settles via Somnia on-chain reactivity** — no keeper —
   so TEMPO's settlement observation is native, not bolted on.
6. **Agentic positioning**: Somnia's own thesis names agents as first-class
   economic participants; TEMPO is that thesis applied to market structure.

### 7. Why DreamDEX

The mechanism is DreamDEX-specific end to end: mint-a-pair zero-inventory
quoting; the on-chain opening price as strike; mandatory order expiry as a
built-in dead-man's switch; `Finalized`-status claim flow; the
proximity-weighted maker yield TEMPO's quoting is designed to capture; zero
fees making two-sided provision economic; the oracle explorer giving public
provenance for every settlement. A generic prediction-market API has none of
these — the removal test fails in TEMPO's favor.

### 8. Why Event Contracts

Delete Event Contracts and TEMPO has no birth to attend, no strike to anchor
to, no expiry to manage, no settlement to claim, no successor to roll to. The
window lifecycle is not a feature TEMPO uses — it is the product TEMPO runs.

### 9. Why AI

Fair value is a synthesis problem over real, moving inputs (spot feed vs
strike, realized vol, time-to-expiry diffusion, order-flow imbalance,
inventory) recomputed continuously across ~14 windows — a human cannot hold
this book. The endgame is a risk decision under exploding delta. The taker and
the maker run genuinely different policies over the same inputs and disagree in
the wild (live-verified in the demo logs). Nothing is scripted: policies are
pure functions of real inputs, unit-tested, and every decision is journaled
with its exact inputs (observability §31). AI-removal test: a human manually
re-quoting 14 windows each second-scale event is economically impossible.

### 10. Participants

- **GENESIS** (maker agent, own key + capital): anchors the opening, re-quotes
  reactively, manages endgame, claims, rolls. Earns spread + venue maker yield.
- **VECTOR** (taker agent, own key + capital, independent policy + risk
  tolerance): takes IOC when its fair value diverges from the touch beyond its
  threshold; rejects or hedges otherwise. Proves the book is real by trading
  it — and disagrees with GENESIS by design (multi-agent test).
- **Traders** (humans/other bots): trade against the anchored book.
- **The venue**: matches, settles via oracle + reactivity, pays winners.

### 11. Market Structure

A rolling series of ephemeral binary windows becomes a *continuous* market:
genesis liquidity is supplied by an autonomous firm; the opening price is
anchored to a public oracle reference; price discovery begins at birth instead
of at first coincidence of opposites; the endgame is quoted by machines; every
settlement is publicly auditable at the oracle explorer.

### 12. Economic Model

- Collateral: tUSDC (testnet, 6 dec) / USDso (mainnet, 18 dec) — scale always
  derived from `decimals()`, never hardcoded.
- GENESIS earns: bid-ask spread captured at fills + proximity-weighted maker
  yield + endgame convergence (quotes approach the certain payoff as expiry
  nears).
- GENESIS risks: inventory skew picked up between quotes (bounded by max
  inventory per window + firm capital cap), adverse selection near price
  shocks (bounded by reactivity — re-quote in the same block era), locked
  capital (orders carry expiry ≤ window expiry, aging off automatically).
- VECTOR earns: |fair − touch| beyond threshold + fees (zero) − adverse
  selection. Its loss cap is its per-window stake budget.
- All P&L is deterministic from real fills and settlements; nothing is
  simulated at runtime.

### 13. Protocol Lifecycle

```text
BIRTH      watchMarkets({discover}) sees the window the block it deploys
ANCHOR     read on-chain status(1), opening price, book params; appraiser
           computes fair value from price-feed spot vs strike + realized vol
GENESIS    post Buy Up @ p−δ and Buy Down @ (1−p)−δ (post-only, expiry =
           min(requote interval past, window expiry)) — zero inventory
REPRICE    on fill/book/price events (reactivity + live watches): recompute,
           cancel stale quotes, re-post; inventory skew bends the mid
ENDGAME    last phase: tighten δ, skew to certainty, enforce risk caps
LOCK       no new orders; flatten-or-hold decision (policy)
SETTLE     observe Resolved/Voided on-chain; fetch resolution + oracle link
CLAIM      redeem winning side (or both at 0.5 on void) via trader.redeem
ROLL       successor window appears → back to BIRTH
```

### 14. Architecture

```text
                    ┌──────────────────────────────┐
                    │        @tempo/core           │
                    │ config · exchange (markets-sdk│
                    │ + reactivity + price feed)    │
                    │ fairValue · risk · journal    │
                    │ provenance · quant            │
                    └──────┬───────────────┬───────┘
                           │               │
              ┌────────────┴───┐   ┌───────┴────────┐
              │  @tempo/engine │   │   tempo CLI    │
              │ GENESIS ·      │   │ markets · watch│
              │ VECTOR · firm  │   │ book · agents  │
              │ runtime + SSE  │   │ trade · verify …│
              └──────┬─────────┘   └────────────────┘
                     │  HTTP + SSE (same core)
              ┌──────┴─────────┐
              │   tempo-web    │ single screen, live panels
              └────────────────┘
```

CLI and web share `@tempo/core`; the engine is the only writer, the CLI can run
one-shot actions through the identical execution path.

### 15. SDK / API / Tool Utilization

| Capability | What it is | How TEMPO uses it | Why it matters |
|---|---|---|---|
| markets-sdk unified tier | Symbol/human-unit trading | `createOrder` (IOC/POST_ONLY), `mintSet`/`burnSet`, `fetchOpenOrders`, `cancelOrder`, `fetchMyTrades` | The docs' instructed primary surface; snapping to tick/lot built in (≥0.28) |
| markets-sdk client tier | bigint-exact on-chain truth | `getMarketOnchain` (status gating), `getBinaryBookParams`, `getOpeningPrices`, `getOutcomeBalance`, `listBinaryMarkets({Finalized})`, `listPastBinaryMarkets`, `getMarketResolution`, `getCandles`, `getFills` | Every write gated on chain truth; settlement audit; history |
| markets-sdk trader tier | Raw writes | `trader.redeem` (explicit outcome index; void-aware), `trader.faucet` (10k tUSDC), `trader.placeOrder` fallback | The few writes the unified tier doesn't model |
| Live watches | Local book materialization from logs | `watchMarkets({discover})`, `watchMarket(pool)`, `watchUser`, `getLiveBinaryOrderBook`, `getLiveFills/UserFills/UserOrders` | Event-driven quoter; zero polling; birth discovery |
| `@somnia-chain/reactivity` | `somnia_watch` + same-block sims | `createReactivity(exchange.client).watch(...)` for fill/book reactivity; `ethCalls` attached | The Somnia-native reaction path; no other EVM |
| Price feed | Official spot + EMA | `fetchPrice`, `watchPrice` (BTC/ETH, USDC quote) | The non-circular directional signal |
| `realtime_sendRawTransaction` | One-round-trip writes | Via SDK writes (fixed fees, tracked nonce) | Sub-second confirmations for the quoter loop |
| ABIs export | Same signatures the SDK encodes | Contract tests decode reverts | No signature drift |
| Oracle explorer | Public resolution pipeline | Settlement panel deep links | Provenance for every settlement shown |
| Bot Kit (patterns, edge tooling, skills) | Canonical guards | Its sharp edges encoded as policy + tests; `edge-analytics` methodology informs the post-run edge report | Build on the ecosystem's own institutional knowledge |
| HTTP API / spot WS / ccxt / MCP / CLI | Spot surfaces | **Justified non-use** — no EC endpoints; EC data is chain-native | Documented in RECONNAISSANCE §3 |

### 16. CLI

```bash
tempo doctor                  # chain/indexer/feed/keys/venue probe (read-only)
tempo markets                 # live windows: series, seconds-left, status, touch
tempo watch [--asset BTC]     # streaming market + book view (reactivity)
tempo book <symbol>           # materialized 4-sided book + fair value
tempo agents                  # firm roster: capital, inventory, policy params
tempo firm start              # run the firm (GENESIS + VECTOR) — real trading
tempo firm simulate           # same loop, DRY_RUN: decisions logged, nothing sent
tempo trade <symbol> <up|down> <qty> [--price p]   # manual IOC via core
tempo positions               # outcome balances + PnL (on-chain reads)
tempo claims                  # claimable settled markets; --claim to redeem
tempo activity [--since 1h]   # chronological journal: events → decisions → txs
tempo verify [--since 24h]    # replay journal, cross-check every tx on-chain
tempo settlements [--limit N] # resolved windows + oracle explorer links
tempo backtest [--days 7]     # replay fair value vs realized outcomes on real candles
tempo testnet faucet          # mint testnet collateral (testnet only)
```

Every command executes `@tempo/core`; nothing duplicates logic the web uses.

### 17. SDK (`@tempo/core` public surface)

```ts
import { TempoConfig, loadConfig } from "@tempo/core";
import { TempoExchange }   from "@tempo/core";   // markets-sdk wrapper: markets(), book(), opening(), spot(), trade(), mintSet(), cancelAll(), claims(), claim(), positions()
import { FairValue }       from "@tempo/core";   // fairValue({spot, strike, sigma, t, ...}) → {p, band}
import { RiskEngine }      from "@tempo/core";   // check(order|quote, book, inventory, capital) → allow|reject{reason}
import { Journal }         from "@tempo/core";   // append(record), tail(), since(), replay(): typed, provenance-tagged
import { quantizePrice, quantizeSize, probToTicks, ticksToProb } from "@tempo/core";
import { GenesisMaker }    from "@tempo/core";   // policy: quotePlan(market, book, fv, inv, risk) → QuotePlan | null
import { TakerPolicy }     from "@tempo/core";   // policy: takerPlan(market, book, fv, risk) → TakerPlan | null
```

Typed, documented, failure-explicit (throws typed errors; returns honest
`UNAVAILABLE` states where the chain has no answer yet).

### 18. Agent Coordination

The firm is a deterministic schedule over event loops, not a conversation:
each agent owns its key, its capital ledger, and its policy; a shared
`RiskEngine` enforces per-window inventory and firm capital caps on *every*
plan before execution; the journal serializes every decision with agent id,
inputs, and outputs. Agents never share keys (venue blocks self-matching
anyway; kit docs warn two senders on one key race nonces).

### 19. Real Data Flow

```text
Price feed (official BTC/ETH spot+EMA, GraphQL)  ─┐
Chain: opening prices, status, book params        ─┤
Live watches: books, fills, user orders (logs)    ─┼→ Appraiser → FairValue
Reactivity: events + same-block eth_call results  ─┘        ↓
                                                 RiskEngine → QuotePlan/TakerPlan
                                                        ↓
                                       SDK write (realtime_sendRawTransaction)
                                                        ↓
                                     receipt → Journal → CLI/Web (SSE)
```

Every displayed number has a provenance tag: source, endpoint/contract, block,
timestamp. See §31.

### 20. Event Contract Flow

See §13. Contract-level specifics honored: state keyed by marketId; writes
gated on `getMarketOnchain().status === 1`; expiry ≤ window expiry in
nanoseconds; post-only reverts (`PostOnlyWouldCross`) treated as "book moved
into me" — re-quote, not fault; IOC remainders never rest; cancels refund to
wallet; taker charged fill price; `Finalized` claim flow with explicit outcome
index (both sides at 0.5 when voided); pools recycled → never keyed by pool.

### 21. Security Model

- **Key separation**: maker and taker use distinct keys; neither needs
  withdrawal rights on testnet; the architecture matches the documented
  operator/session-key split (hot operator trades, owner funds), with
  operator-registry wiring as a config option.
- **No key, no writes**: the CLI/engine run read-only without keys (honest
  UNAVAILABLE for actions, not fakes).
- **Input boundaries**: every order passes probability ∈ (0,1), tick/lot
  grid checks, expiry caps, risk caps before signing; malformed input fails
  locally, never on-chain.
- **Revert honesty**: SDK ≥0.23 throws decoded reverts; every write checks
  `receipt.status` too (kit guard #2); failed sends are journaled as failures.
- **No self-dealing**: maker and taker can never hold mirrored quotes at
  crossing prices (venue blocks self-match; policies keep distinct books).

### 22. Failure Model

First-class, journaled, and demoable: locked-market reverts (caught + decoded);
post-only crossings; underfunded local rejects; expired orders aging off;
indexer lag → chain-gated writes; WS disconnect → reconnection with backoff +
snapshot re-hydration (SDK watch healing); oracle void → claim both sides at
0.5; agent crash → orders expire (dead-man's switch), journal replay shows
exactly where it stopped.

### 23. Testing Strategy

Vitest, layered: **unit** (fair value math, quantization, risk caps, policies,
journal, provenance), **sdk** (every public core method against the live
deployment read-only), **integration** (SDK↔indexer↔chain↔feed), **contract**
(faucet → approve → mintSet → place → cancel → redeem with real txs),
**e2e** (genesis → quote → taker → lock → settle → claim on a real window),
**failure** (each §22 path), **security** (key absence, malformed orders,
expiry caps, risk bypass attempts), **economic** (inventory/capital caps,
spread capture accounting, endgame convergence), **cli** (every command).

### 24. `/test` Folder Structure

```text
test/
├── unit/        # pure logic, no network
├── sdk/         # @tempo/core surface, live read-only
├── integration/ # cross-service wiring, live
├── contract/    # real txs on testnet (gated, evidenced)
├── e2e/         # full window lifecycle
├── failure/     # every failure path
├── security/    # boundaries and abuse
├── economic/    # caps, accounting, convergence
├── cli/         # command execution
├── fixtures/    # captured real responses (provenance-marked, never fabricated)
├── scripts/     # live runners + evidence capture
└── reports/     # test output + tx evidence (real hashes only)
```

### 25. Test Coverage Plan

Every public SDK method ≥1 test; every policy branch; every risk cap;
every CLI command; every failure path in §22; contract tests cover reads,
writes, events, reverts, expiry; economic tests assert caps bind *before*
capital exhaustion. Coverage target: statements ≥85% on `@tempo/core`.

### 26. Testnet Deployment Plan

No contracts of our own need deploying — TEMPO is protocol-native and uses
DreamDEX's audited core (Hacken-audited spot engine family). Deployment =
config + funded keys: `faucet()` mints 10k tUSDC per call per key. Fresh-clone
reproduction in README §Reproducibility.

### 27. 90-Second Demo (second-by-second)

- **0–10s** — `tempo markets`: 14 live windows, real strikes from the chain;
  the 1m series shows empty books (the problem, on-chain).
- **10–25s** — `tempo firm simulate` already running against the live venue →
  a 1m/5m window birth is detected; GENESIS posts Buy Up + Buy Down anchored
  to fair value; `tempo book <symbol>` shows the materialized two-sided book;
  tx hashes stream into the journal.
- **25–50s** — spot feed moves; appraiser re-prices; re-quotes land (hashes);
  VECTOR's fair value diverges from GENESIS's touch → IOC taker fill prints on
  a real trade; both ledgers update from real fills.
- **50–70s** — final 20 seconds: quotes converge toward certainty; the window
  locks; the oracle settles (resolution + explorer link shown); `tempo claims`
  lists the winnings; `--claim` redeems; tUSDC returns to the wallet on-chain.
- **70–90s** — `tempo verify` replays the journal and cross-checks every tx on
  chain; the web dashboard (one screen) has shown the whole lifecycle live.

### 28. Holy-Shit Moment

Watching an **empty book materialize into a two-sided market the moment a
window is born** — then watching the two agents *disagree* about the same real
book and trade against each other, and the winner get paid by the chain at
settlement. Every number on screen is a real on-chain fact with a hash.

### 29. UI / UX

Single screen, no page scroll, dark premium financial aesthetic (deep ink,
one accent, mono numerics). Panels: venue pulse (windows + birth clock),
selected window book + fair-value band, firm roster (capital, inventory, P&L —
real), activity tape (events → decisions → tx hashes), settlement feed with
oracle links. Internal panel scroll only; navigation instantaneous; honest
`NO DATA`/`PENDING` states.

### 30. Animation System

Animations visualize real state only: a birth pulse when a window deploys;
quote shimmer on new resting orders; a tick trail on fills (from
`getLiveFills`); an expiry arc per window; a settlement flash + claim ripple on
real redemption txs. Nothing animates without a journal record behind it.

### 31. Observability

Every event, decision, and write is journaled (JSONL, typed):
`{ts, agent, type, inputs{spot, strike, sigma, book, inventory}, output{plan}, tx?, block?, error?}`.
`tempo verify` replays and cross-checks each tx hash against the chain.
Provenance tags name the exact source (feed endpoint, indexer, contract
address, block) for every displayed value.

### 32. Zero-Mock Audit

MOCKED VALUES = 0. Prices/probabilities: derived from real feed + chain inputs.
Balances: on-chain reads. Fills: real trades. Settlements: on-chain resolution.
P&L: computed from real fills/settlements. No fabricated history: when a value
is unavailable (e.g., market just listed, no candles yet) the UI shows
`NO DATA`. The only "simulated" thing in the repo is the *backtest engine*,
which is clearly labeled, driven by real recorded candles, and never rendered
as live state. Test fixtures capture real responses and are marked with their
capture provenance.

### 33. SDK Utilization Audit

See Part I §5 + RECONNAISSANCE §3 — every relevant official capability is
either used (with where/why) or explicitly justified as non-use.

### 34. Reproducibility

```bash
git clone <repo> && cd tempo
npm install
cp .env.example .env            # NETWORK=testnet
npm run faucet                  # fund both agent keys (testnet, on-demand mint)
npm test                        # full suite incl. live testnet reads
npx tsx packages/cli/src/index.ts markets      # or: npm run cli -- markets
npm run firm                    # the live demo loop
npm run web                     # http://localhost:7333
```

No hidden manual steps; no preloaded data; dry-run mode default for anything
that spends.

### 35. Startup Potential

The opening-auction service generalizes to any ephemeral-market venue (sports
minutes, news windows, more assets). TEMPO's yield is the venue's own maker
subsidy; the moat is the fair-value engine + reactivity infrastructure +
operational record. wedge: run other people's quotes as a managed liquidity
service ("liquidity-at-birth as a subscription").

### 36. Ecosystem Impact

Every window on DreamDEX opens liquid → better UX for traders, more fills for
the venue, a visible showcase of Somnia's reactivity/perf thesis, and a
reference implementation (CLI+SDK) other agent developers can build on —
exactly the "agentic L1" behavior the ecosystem is pursuing.

### 37. Competitive Landscape

Bot-kit `ec-maker` (polling, mid-of-book, no genesis), competition examples
(spot-centric), Polymarket-style AMMs (no CLOB, no window genesis), CEX binary
desks (off-chain). TEMPO's differentiation: genesis anchoring + reactivity +
full lifecycle autonomy + zero-inventory quoting + public reproducibility.

### 38. Risks

- Venue endpoints/venue-ids move (mitigated: resolve from live rows; config
  overrides; doctor command).
- Thin testnet traffic → few external fills (mitigated: VECTOR generates real
  flow; demo narrative works with agent-vs-agent + real settlement).
- Indexer lag (mitigated: chain-gated writes everywhere).
- Oracle voids (handled: both-sides claim path).
- Fee/gas surprises on mainnet (fixed-fee ceiling + honest balance pre-checks).

### 39. Judge Score Prediction

Novelty 8/10 · EC necessity 10/10 · DreamDEX depth 10/10 · Somnia fit 10/10 ·
AI necessity 8/10 · Demo 9/10 · Feasibility 8/10 · SDK utilization 10/10 ·
Startup 8/10 · Memorability 9/10 → weighted ≈ **9.0/10**.

### 40. 30-Second Final Pitch

"Every fifteen minutes, DreamDEX births a new prediction market — and every
time, it's born empty. Exchanges run opening auctions; nobody runs one here,
because it takes a machine. TEMPO is that machine: autonomous agents that
anchor every newborn window to the oracle's live price, quote two sides with
zero inventory, fight over the book at machine speed, settle, claim, and roll
— all on-chain, all on Somnia's 100-millisecond blocks, every decision journaled
with its transaction hash. The venue's missing opening auction, as a CLI, an
SDK, and a screen you can watch all day."
