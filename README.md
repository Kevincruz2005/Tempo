# TEMPO

TEMPO is an autonomous opening-auction firm for DreamDEX Event Contracts on
Somnia. GENESIS anchors newborn BTC/ETH Up/Down windows with two-sided quotes;
VECTOR independently takes IOC positions when its estimate differs from the
touch. The runtime follows each market from birth through settlement, claim,
and roll, with every input, decision, receipt, and failure written to a typed
JSONL journal.

The default is read-only dry-run. No private key means no send, and no missing
economic value is replaced with a demo number.

**Verification:** 2,086 offline Vitest cases pass, including a 2,048-case
deterministic economic invariant matrix across 6- and 18-decimal grids. Live
evidence independently verifies 31/31 funded Shannon transaction receipts.
The matrix caught and now guards an 18-decimal raw/human/raw conversion edge
that could otherwise lose one tick through binary floating-point formatting.

## Quickstart

Requirements: Node 20 or newer.

```bash
npm install
cp .env.example .env
npm test
npm run cli -- doctor
npm run firm
```

Open `http://localhost:7333`. The dashboard is a fixed single-screen view of
live windows, materialized books, estimates, agents, journal activity, and
finalized settlements.

Live writes require two distinct Somnia Shannon accounts, each funded with STT
from the official faucet. Set `TEMPO_KEY_MAKER` and `TEMPO_KEY_TAKER`, call
`npm run faucet`, and set `TEMPO_DRY_RUN=false` only after reviewing the risk
limits.

## Security

TEMPO has no database, SQL driver, or query-construction layer. SQL injection
is therefore absent by architecture, rather than claimed as a filter over an
SQL surface that does not exist. The real HTTP, browser, signer, and chain
boundaries are hardened instead:

- The dashboard binds to `127.0.0.1` by default. Host-header and same-origin
  checks reject DNS rebinding and cross-site browser requests.
- The server is GET-only and read-only, with an explicit API route allowlist,
  8 KiB header and 2 KiB URL bounds, request timeouts, per-IP API rate limits,
  and total/per-IP SSE connection caps with backpressure cleanup.
- CSP, frame denial, MIME sniffing prevention, opener/resource isolation,
  no-referrer, and restrictive browser permissions are sent on every response.
- Static paths are decoded and containment-checked; traversal, dotfiles,
  backslashes, malformed limits, and unknown API routes fail closed.
- API and SSE payloads recursively redact credential-like keys. The browser
  HTML-encodes chain/indexer/journal strings, allowlists dynamic CSS classes,
  accepts only HTTPS oracle links, and discards malformed SSE JSON.
- The official markets SDK remains exactly pinned at `0.29.0`; `npm audit`
  reports zero known vulnerabilities across production and development dependencies.
- Signer keys are never returned by the snapshot API. No key means no write;
  keys must differ; every trade is risk-, tick/lot-, expiry-, and live-status-
  gated before the official SDK sends it.

The built-in server is an operator-local dashboard, not a public auth system.
To expose it remotely, terminate TLS at an audited reverse proxy, require
authentication and authorization there, restrict ingress with a firewall, and
keep `TEMPO_HTTP_HOST=127.0.0.1` between the proxy and TEMPO. Security evidence
is in `test/security/boundaries.test.ts` and
`test/reports/security-20260902.md`.

## Packages

- `@tempo/core`: config, decimal-aware quantization, exchange wrapper, fair
  value, risk, policies, journal, ledger, settlement and backtest reads.
- `@tempo/engine`: live-watch firm runtime, lifecycle state machine, HTTP/SSE.
- `tempo-cli`: every operator and audit command over `@tempo/core`.
- `packages/web`: fixed-viewport dashboard over the engine API and SSE journal.

`@somnia-chain/markets-sdk` is pinned at `0.29.0` and is used at all three
levels: unified symbols/human units, client chain/indexer/live-store reads, and
trader writes.

## CLI

```text
tempo doctor
tempo markets
tempo watch [--asset BTC]
tempo book <symbol-fragment>
tempo agents
tempo positions
tempo firm simulate|start
tempo trade <fragment> <up|down> <qty> [--price p]
tempo claims [--claim]
tempo activity [--n 50]
tempo verify
tempo settlements [--limit N]
tempo backtest [--limit N]
tempo faucet
```

Run via `npm run cli -- <command>`. `trade`, `--claim`, `faucet`, and live firm
writes fail explicitly without a signer. Every order is chain-gated on status
`1`, tick/lot aligned from the live pool, given a nanosecond dead-man expiry,
and receipt-checked.

## Reproducibility

```bash
npm install
cp .env.example .env
npm test                         # offline: no RPC or API substitutes
npm run test:live                # official indexer + RPC + price feed
npm run test:chain-gate          # real non-trading-market write gate
npm run test:cli-live            # full read-only CLI matrix
npm run test:contract            # funded keys: real transaction sequence
TEMPO_DRY_RUN=false npm run test:e2e
npm run firm                     # dry-run dashboard, zero sends
npm run record:demo              # 90-second recording of a running live dashboard
```

Current evidence is under `test/reports/`. On 2026-09-02 the offline suite
passed 2,086 tests, live SDK/integration passed 3 tests, and the live non-trading
chain gate passed. The funded contract sequence recorded faucet, mint, quote,
cancel, IOC fill, and redemption receipts; `tempo verify` independently found
all 31 journaled transaction hashes on Shannon with successful receipts.
A narrated 90-second 1440x900 live dashboard recording is saved as
`test/reports/tempo-demo-90s-narrated.mp4` with codec and checksum evidence in
`test/reports/demo-20260902.md`; the raw capture is preserved alongside it.

## Provenance

| Feature | Official capability | Display/audit source |
| --- | --- | --- |
| Window discovery | markets SDK `loadMarkets` + binary registry | Event-contract indexer; market id and venue id |
| Book/watch | `watchMarkets`, `watchMarket`, live binary store | Somnia chain logs via markets SDK live tail |
| Same-block event path | markets SDK reactivity integration | `somnia_watch`; poll heartbeat is labeled fallback |
| Opening boundary | `getOpeningPrices` or fixed market `strike` | Indexer/on-chain market data, scale matched to official feed |
| Spot signal | markets SDK `fetchPrice` / `watchPrice` | Official price feed value, EMA, block, timestamp |
| Fair value | `@tempo/core` driftless diffusion | **AI ESTIMATE**, with spot/strike/sigma/time inputs |
| Writes | markets SDK trader tier | `realtime_sendRawTransaction` receipt hash/status |
| Settlement | `listBinaryMarkets({status:"Finalized"})` + chain | Winning outcome/void plus oracle explorer URL |
| Capital/positions | ERC-20 and ERC-6909 reads | On-chain balances; `UNAVAILABLE` without an address |
| CLI/web | `@tempo/core` | Identical methods; web state delivered by engine SSE/API |

## SDK Utilization

| Surface | Used for |
| --- | --- |
| Unified tier | symbols, human-unit books/trades, open orders, mint/burn |
| Client tier | live/finalized discovery, status gates, tick/lot, opening, resolution, candles, fills, watches |
| Trader tier | explicit-expiry binary orders, redeem outcome index, testnet faucet |
| Price feed | spot, EMA, historical observations, live ticks |
| Native RPC | one-round-trip send/confirm through SDK writes |
| Reactivity/live store | event-driven book/fill/user state with polling fallback |

DreamDEX spot HTTP/WS APIs are intentionally not used because they do not
expose Event Contracts. Data Streams and decentralized LLM inference were
evaluated but are not load-bearing to deterministic market making.

## Zero-Mock Audit

- Live prices, books, balances, fills, settlements, and hashes originate from
  official services or chain reads.
- Probabilities and volatility are labeled estimates and record exact inputs.
- Missing price history, keys, balances, books, claims, and receipts render
  `NO DATA`, `UNAVAILABLE`, `PENDING`, or fail the command.
- Unit tests use labeled mathematical inputs, never intercepted chain/API
  responses. Production code consumes no fixtures.
- Backtest reads finalized markets and historical official feed observations;
  it prints `NO DATA` instead of applying a volatility default.

## Demo

1. `tempo markets`: show the rolling windows, chain-derived status, and venue ids.
2. `tempo firm simulate`: show birth discovery, official feed blocks, and
   journaled GENESIS/VECTOR decisions with zero sends.
3. With funded keys, run `tempo firm start`: show post-only receipt, IOC fill,
   settlement, explicit redemption, then `tempo verify` against chain receipts.
4. Keep the dashboard visible throughout; every displayed value identifies its
   fact/estimate status and source.

Funded receipt evidence is in `test/reports/contract-live.md`,
`failure-postonly-live.md`, `e2e-live.md`, and `verify-20260902.md`.
