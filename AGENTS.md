# AGENTS.md — TEMPO build guardrails (read this first)

This repository is **TEMPO**: an autonomous "opening auction" firm for DreamDEX
Event Contracts on the Somnia blockchain. Two docs are the source of truth:

- `docs/RECONNAISSANCE.md` — verified ecosystem facts: endpoints, contract
  addresses, SDK surface, market-structure mechanics. **Do not re-derive or
  guess these.**
- `docs/DESIGN.md` — the full product design (architecture, agent policies,
  CLI/SDK surface, failure model, test plan). Build to that spec.

## Non-negotiable rules

1. **ZERO MOCKED VALUES.** Every price, probability, balance, fill, settlement,
   P&L number must come from the live chain / official indexer / official price
   feed / deterministic math over those inputs. If a value is unavailable,
   surface `UNAVAILABLE` / `PENDING` / `NO DATA` — never invent it. The only
   simulation allowed is the clearly-labeled backtest, driven by real recorded
   candles, never rendered as live state.
2. **Gate every write on live on-chain status.** `client.getMarketOnchain(id).status === 1`
   (Trading) before `createOrder` / `mintSet` / anything state-changing. The
   indexer lags by seconds.
3. **Check receipts.** Unified verbs return the receipt at
   `(order.info as PlaceOrderResult).receipt` — not on the order. Use SDK
   ≥0.28 (installed; currently 0.29.0) so reverts throw decoded errors and
   prices snap to the tick grid.
4. **Quantize by hand to tick/lot** (read them via
   `client.getBinaryBookParams(pool)` — testnet tick/lot are `1000n` on
   6-decimal collateral = 0.001; mainnet is `1e15` on 18-decimal). A constant
   that works on testnet misprices mainnet by 10^12.
5. **Key state by `marketId` / symbol, never pool address** — pools are
   recycled across windows.
6. **Order expiry is mandatory** (`expireTimestampNs`, nanoseconds, ≤ market
   expiry; `0` reverts). Set it just past the requote interval so a crashed bot
   ages off the book.
7. **IOC for taker, post-only for maker.** Catch `PostOnlyWouldCross` and
   re-quote — it means the book moved into you, not a fault.
8. **Collateral decimals come from the contract** (testnet tUSDC = 6, mainnet
   USDso = 18). Never hardcode a scale.
9. **Settled markets leave the live list.** Claims come from
   `client.listBinaryMarkets({ status: "Finalized", ... })` + `trader.redeem`
   with an explicit outcome index; on voided markets claim BOTH sides at 0.5.
   Redeeming a losing side succeeds and pays 0 — check `winningOutcome` /
   `isVoided` first.
10. **Two agents, two keys.** GENESIS (maker) and VECTOR (taker) never share a
    key (venue blocks self-matching; shared keys race nonces).
11. **Read-only without a private key.** Missing key = honest `UNAVAILABLE` on
    write actions. Never fake an execution.
12. **Provenance on every displayed value**: source (feed/indexer/chain),
    endpoint/contract, timestamp/block, journaled.
13. **QUANTITATIVE ESTIMATE ≠ ON-CHAIN FACT.** Every fair-value probability, volatility
    estimate, and agent decision is an *estimate* — label it as such wherever
    displayed (UI, CLI, journal) and journal its exact inputs. On-chain status,
    prices, opening prices, fills, balances, and settlements are *facts* —
    render them with their provenance. Never present the appraiser's number as
    an authoritative market oracle.

## Where things are

```text
docs/            RECONNAISSANCE.md + DESIGN.md (read both before coding)
probe/           live-probe.ts — known-good read-only testnet probe
packages/core    @tempo/core  — config, exchange wrapper, fairValue, risk,
                 quant, policies, journal (pure logic + SDK wrapper)
packages/engine  @tempo/engine — the agent firm runtime + SSE server
packages/cli     tempo CLI — thin shell over @tempo/core (no logic here)
packages/web     single-screen dashboard (static files, SSE client)
test/            unit/ sdk/ integration/ contract/ e2e/ failure/ security/
                 economic/ cli/ fixtures/ scripts/ reports/
```

## Environment

- Node ≥ 20, npm workspaces, TypeScript ESM, run with `tsx` (no build step).
- Env: `.env` from `.env.example`. `TEMPO_NETWORK=testnet|mainnet`
  (default testnet). Optional keys `TEMPO_KEY_MAKER` / `TEMPO_KEY_TAKER`.
- Endpoints (testnet): RPC `https://api.infra.testnet.somnia.network`,
  WS `wss://api.infra.testnet.somnia.network/ws`,
  indexer `https://dev.smk.somnia.host/v1/graphql`,
  price feed `https://price-feed.dev.oracle.somnia.host/v1/graphql` (quote USDC).
  Mainnet equivalents are in RECONNAISSANCE §2. Venue IDs move — resolve from
  live market rows, offer `TEMPO_VENUE_ID` override.
- Testnet collateral mints on demand: `exchange.trader.faucet()` = 10,000 tUSDC
  per call per key (cap; more reverts with `FaucetCapExceeded`).
- Chain IDs: testnet 50312, mainnet 5031. Both must match in signatures and
  SIWE (if HTTP API is ever used — it has no event-contract endpoints; EC
  surface is the markets SDK only).

## Working agreements

- TypeScript strict; no `any` in `@tempo/core` public surface; typed errors.
- Pure logic (fair value, quant, risk, policies) must have **no network
  imports** so it is unit-testable without mocks.
- Journal every event/decision/write (JSONL, typed) — `tempo verify` replays
  it and cross-checks tx hashes on-chain.
- Tests: `npx vitest run` for unit (offline); `test/scripts/*` for live
  evidence (real tx hashes recorded under `test/reports/`). Never fabricate a
  transaction hash or a test result.
- Keep every page/panel of the web UI single-screen (no page scroll).
- If the indexer/venue moves and markets list comes back empty, run
  `probe/live-probe.ts` first, then check `venueId` on live rows — do not
  hardcode a new venue id silently; print it and gate via env.
