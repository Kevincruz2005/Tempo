# TEMPO — Ecosystem Reconnaissance

> All findings below were verified against live documentation and, where marked
> **[LIVE-VERIFIED]**, against the real Somnia Shannon testnet on 2026-09-01 from
> this repository (`probe/live-probe.ts`).

---

## 1. Why does Somnia exist? (the technical/economic thesis)

Somnia is an EVM-compatible L1 built by the team behind Improbable for a single
purpose: **fully on-chain, mass-consumer, real-time applications**. The thesis is
that general-purpose EVM chains — even rollups — cannot host an order book, a
game tick loop, or a reactive agent, because multi-second blocks, long finality,
and interpreted execution make continuous on-chain interaction economically and
mechanically impossible.

Somnia's answer is architectural, not incremental:

| Component | What it does | Why it matters here |
| --- | --- | --- |
| **MultiStream consensus** | Decouples data chains (every validator streams blocks asynchronously) from a PBFT consensus chain that finalizes their tips | Throughput scales near-linearly; sub-second finality |
| **Compiled EVM** | Compares contracts to native code instead of interpreting bytecode | Order-book matching on-chain at CEX-like speed |
| **IceDB** | Custom state storage | Fast state reads/writes for hot markets |
| **~100 ms blocks, sub-second finality, 1M+ TPS design (400K+ mainnet claim)** | The headline numbers | A 15-minute event window is *many thousands of blocks*; a re-quote loop is viable |

Beyond raw performance, Somnia ships three capabilities that (to the docs'
claim, and we found no counterexample) **no other EVM has**:

1. **On-chain reactivity** — persistent event subscriptions stored in chain
   state; validators include synthetic transactions calling a handler contract
   when matching events commit. "The reaction is part of chain execution."
2. **Off-chain reactivity** — a WebSocket subscription (`somnia_watch`) that
   pushes matching events **together with read-only `eth_call` simulation
   results evaluated against the same block**, atomically. No polling; no
   read-after-event race.
3. **Native RPC extensions** (`somnia_*` namespace) — native ledger blocks,
   reactivity subscription reads, `sendSessionTransaction`, locally derived
   session keys, and `realtime_sendRawTransaction` (send + confirm in one
   round trip; the markets SDK uses it for every write).

Somnia positions itself explicitly as **the Agentic L1**: its docs carry an
entire *Agents* section (deterministic decentralized LLM inference prototype,
JSON-API request agent), and its marketing names agents as first-class users.
DreamDEX exists on Somnia specifically because a fully on-chain CLOB with
CEX-grade execution — zero fees, gas-sponsored, settle-in-same-block — is only
practical at this performance level. Event Contracts make sense here because
the whole venue can settle oracle-driven markets **without a keeper**: the
oracle hub's answer is delivered to the market contract by on-chain reactivity.

**Thesis in one line:** when block time drops to ~100 ms and gas to dust, the
market structure itself changes — continuous on-chain markets, machine-speed
coordination, and agents as liquidity providers become viable *for the first
time*. TEMPO is built on exactly that edge.

---

## 2. DreamDEX — the venue

Fully on-chain CLOB on Somnia ("CEX performance with DEX decentralisation,
zero fees"). USDso (FraxUSD-backed via LayerZero, 18 decimals) on mainnet;
tUSDC (6 decimals) on Shannon testnet. Spot, simple swap, stop orders, and
**Event Contracts** — Up/Down binary markets on BTC and ETH prices over fixed
windows (15m, 1h on mainnet; the testnet deployment we verified also runs
**1m, 5m, 240m, 1440m**). The line to beat is the window's **opening price**,
published on-chain. Winners redeem 1 collateral per contract; loser pays zero;
all fees (maker, taker, settlement) are zero.

### Market structure facts that shape TEMPO

- **One book, two sides.** Up and Down trade on a single book quoted in Up
  terms; a Down price is `1 − up`.
- **Four fill paths** — direct Up, direct Down, **mint-a-pair** (two
  opposite-side buyers cross with *no seller*: the pool mints a fresh Up/Down
  pair from their combined collateral) and burn-a-pair. Mint-a-pair means a
  resting Buy Up at *p* + Buy Down at `1 − p` is a **complete two-sided quote
  with zero inventory**.
- **Escrow**: buys escrow collateral (vault-first), sells escrow outcome
  tokens (you can only sell what you hold; `mintCompleteSet` converts 1
  collateral → 1 Up + 1 Down; `mergeCompleteSet` reverses). Cancels refund the
  exact escrow to the wallet; a taker is charged the *fill* price, not its
  offer.
- **Order expiry is mandatory** (`expireTimestampNs`, capped at market expiry;
  `0` reverts) — a built-in dead-man's switch for autonomous bots.
- **Lifecycle** `Listed(0) → Trading(1) → Locked(2) → Resolved(4) | Voided(5)`,
  time-derived on-chain; the indexer lags by seconds, so every write must be
  gated on `getMarketOnchain(marketId).status === 1`.
- **Settlement**: the question is scheduled on the OracleHub at creation with
  gas reserved; when the answer posts, **Somnia on-chain reactivity delivers it
  to the hub callback** — no keeper. Backstops: `pokeOracle(questionId)` and
  `voidExpired()`. The full price-source pipeline (every source's returned
  value + receipt, the median, the quorum) is public at
  `https://prd.oracle.somnia.host/questions/{oracleQuestionId}?view=graph`.
- **Markets die on schedule and respawn**; pools are recycled, so state must be
  keyed by `marketId`/symbol, never by pool address. Settled markets leave the
  live list and must be claimed from `listBinaryMarkets({status:"Finalized"})`.
- **Maker yield**: DreamDEX pays collateral yield to resting liquidity,
  weighted by proximity to mid — a venue-level subsidy for being the best,
  fastest maker near the fair price.
- **Operators / session keys**: `OperatorPermissionsRegistry` grants
  per-selector capabilities (`placeOrderFor` `0x80054449`,
  `cancelOrderFor` `0xe37b444b`, `reduceOrderFor` `0x364c2587`), global or
  per-pool, with a per-pool denial kill switch. Operators never touch funds —
  orders are owned by and settle to the owner.

### Deployed core (CREATE3 — identical addresses on testnet 50312 and mainnet 5031)

| Contract | Address |
| --- | --- |
| BinaryMarketsModule | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| MarketsCore | `0x2802504314685D89bF6C992CA5a8e7cC78bc0294` |
| BinarySettlement | `0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23` |
| OutcomeToken6909 | `0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9` |
| OracleHub | `0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b` |
| CollateralRouter | `0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C` |
| Collateral (mainnet USDso) | `0x00000022dA000002656c64D9eA6011ea952D008A` (18 dec) |
| Collateral (testnet tUSDC) | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` (6 dec) |

Per-market contracts (market + pool) are read from the module registry — never
hardcoded; pools are recycled. Testnet collateral is minted on demand by
`faucet()` (10,000 tUSDC per call, `msg.sender`-credited).

### Endpoints (verified from bot-kit `ec-core` config)

| Network | RPC | WS RPC | Event-contract indexer | REST/WS (spot only) |
| --- | --- | --- | --- | --- |
| Testnet | `https://api.infra.testnet.somnia.network` | `wss://api.infra.testnet.somnia.network/ws` | `https://dev.smk.somnia.host/v1/graphql` | `https://stg.api.dreamdex.io/v0` |
| Mainnet | `https://api.infra.mainnet.somnia.network` | `wss://api.infra.mainnet.somnia.network/ws` | `https://prd.smk.somnia.host/v1/graphql` | `https://api.dreamdex.io/v0` |
| Price feed (testnet) | `https://price-feed.dev.oracle.somnia.host/v1/graphql` (quote `USDC`) | — | underlying BTC/ETH spot + EMA | — |

**[LIVE-VERIFIED]** 14 live binary markets on testnet across BTC/ETH ×
{1m, 5m, 15m, 60m, 240m, 1440m}; on-chain status 1 (Trading); tick/lot
1e3 (0.001 probability / 0.001 contracts on 6-decimal collateral); opening
prices readable (e.g. BTC strike 7750120e-2 = $77,501.20); price feed returning
BTC $77,505.575 / ETH $2,432.905 with EMA and block numbers. Recently finalized
1m markets show **0 trades** — the books are born empty. Venue IDs are live and
have moved repeatedly (one more for the 1m/5m series than the documented
testnet venue), confirming the docs' warning to resolve them from market rows.

---

## 3. Ecosystem Capability Map

| Tool / SDK | Purpose | Key APIs | What it enables | Required? | TEMPO usage |
| --- | --- | --- | --- | --- | --- |
| `@somnia-chain/markets-sdk` (npm, ≥0.29) | THE event-contract surface: ccxt-flavored unified tier over a per-market CLOB, with live watches | `loadMarkets`, `listLiveBinaryMarkets`, `fetchOrderBook`, `createOrder` (IOC/POST_ONLY), `mintSet`/`burnSet`, `cancelOrder`, `fetchMyTrades`, `client.getMarketOnchain`, `getBinaryBookParams`, `getOpeningPrices`, `getMarketResolution`, `listBinaryMarkets({status:"Finalized"})`, `listPastBinaryMarkets`, `getCandles`, `getFills`, `trader.placeOrder/redeem/faucet` | Discover markets, read books, trade, mint inventory, redeem, audit settlement | **Yes — core** | All reads/writes; unified tier for trading, client tier for on-chain truth, trader tier for redeem/faucet |
| markets-sdk **live watches** | Locally materialized order books from chain logs, zero polling | `watchMarket`, `watchMarkets({discover})`, `watchUser`, `getLiveBinaryOrderBook`, `getLiveFills`, `getLiveUserFills`, `getLiveUserOrders`, React hooks | React to the book the block it changes; discovery of new markets at birth | **Yes — core** | The quoter's event loop; the web book panel |
| `@somnia-chain/reactivity` (also re-exported as `markets-sdk/reactivity`) | Somnia off-chain reactivity: `somnia_watch` WebSocket subscriptions with same-block `eth_call` results | `createReactivity(client).watch({…, ethCalls, onData})`, on-chain `subscribe` (Solidity handlers), `scheduleSubscriptionAt*` | Event → decision in the same block era; zero polling | **Yes — core** | Quoter reactivity on fills; appraiser price-watch wiring |
| markets-sdk **price feed** | Official underlying BTC/ETH spot + EMA (the oracle's own feed family) | `fetchPrice(asset)`, `watchPrice`, candles | Real directional signal distinct from the event contract's own probability (which would be circular) | **Yes — core** | Appraiser fair value |
| markets-sdk **native RPC** | Somnia `somnia_*` namespace, session keys | `createNative`, `sessionAddress(seed)` | Somnia-native key material for agents | Evaluated | Session-key derivation available; raw owner keys on testnet with operator docs (see §5) |
| markets-sdk **chains/ABIs** | viem chains (5031/50312/50383 10 ms), exported contract ABIs | `somniaShannon`, `binaryModuleWriteAbi`, … | Correct chain objects; ABI-level contract tests without hand-copying signatures | **Yes** | Config + contract tests |
| DreamDEX **contracts** (§2 table) | On-chain truth | module registry, pool reads, ERC-6909 balances | Verify every indexered value against chain; settlement audit | **Yes** | `tempo verify` cross-checks |
| Oracle explorer | Public settlement audit trail | `prd.oracle.somnia.host/questions/{id}?view=graph` | Show *why* a market resolved | **Yes (display)** | Web/CLI settlement provenance link |
| DreamDEX **HTTP API** (`api.dreamdex.io/v0`, SIWE auth) | Spot-only request/response workflows | markets, orderbooks, tickers, trades, candles, order mgmt, vault | — | Justified non-use | No event-contract endpoints (docs: "covers spot only"); TEMPO trades EC exclusively |
| DreamDEX **WebSocket API** (`/v0/ws/public`) | Spot market data + per-order lifecycle | orderbook/ohlcv/trades/order channels | — | Justified non-use | EC books stream from chain logs via markets-sdk watches; the spot WS would be a parallel, lower-fidelity feed |
| DreamDEX **Bot Kit** (`somnia-chain/dreamdex-bot-kit`) | Canonical TS core + Python port, strategies, docs, competition examples, skills | `packages/core` (auth/REST/WS/execute/gotchas/nonce/operator), `packages/backtest` (SimPool, fill model), `ec-*` strategies, `docs/*`, `skills/dreamdex-bot` | Proven patterns + sharp edges; `edge-analytics` tool measures maker edge | **Yes — patterns & edge tooling** | We adopt its documented guards (on-chain status gating, tick/lot quantization, wallet reconcile, expiry dead-man switch, claim sweep) as core policy tests; we do not import the spot-oriented client (our surface is the markets SDK) |
| Somnia **Data Streams** | On-chain data streams with schemas/provenance | `somnia-data-streams-sdk` | Publishing agent estimates on-chain with provenance | Evaluated — not used in v1 (extra contract surface, not load-bearing to the primitive; documented) |
| Somnia **Agents** (prototype) | Deterministic decentralized LLM inference | JSON API request agent | On-chain verifiable AI calls | Evaluated — prototype; policy math is deterministic and unit-tested instead (documented) |
| Somnia **CLI** (`somnia-dex-cli`), **ccxt fork**, **MCP server**, `AGENTS.md`/`SKILL.md` | Alternative integrations | — | — | Justified non-use | TEMPO IS a CLI/SDK; using the venue's own markets-sdk directly is deeper than a wrapper-of-a-wrapper |

### Zero-assumption inputs honored

Fixed inputs: Somnia + DreamDEX + Event Contracts + autonomous agents +
blockchain + real economic utility. Everything above was discovered; the
project design (see `DESIGN.md`) follows the chain
**why Somnia → capability → DreamDEX → event-contract primitive → agent
capability → new economic behavior → product**.

---

## 4. Competitive intel (public repos)

Two hackathon entries are already visible on GitHub: a "structural
information-asymmetry risk for event contracts" analyzer and a "capital
allocation vault over event contracts". The Bot Kit's own `ec-*` strategies
(starter, maker, passive, laddering, oracle-follow, settlement) define the
baseline every judge has seen: **polling** (10 s loops), mid-of-book fair
value ("swap in your own signal — the plumbing is the point"), and no genesis
logic. TEMPO's design must be visibly beyond this bar — and it is (see DESIGN §4).
