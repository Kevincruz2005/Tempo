# TEMPO

TEMPO is an autonomous opening-auction firm for DreamDEX Event Contracts on
Somnia. GENESIS supplies the first two-sided book for a newborn rolling binary
window; VECTOR independently takes mispriced IOC liquidity. The system follows
each market through settlement, redemption, and roll with an auditable record
of every input, estimate, decision, safety gate, transaction, and receipt.

**Primitive:** a machine-native opening and continuous-liquidity service for
short-lived, fully on-chain event markets.

Current release evidence: **2,107/2,107 offline tests pass**, including 2,048
decimal/economic invariant cases; critical pure-core statement coverage is
87.35%; dependency audit and repository secret scan report zero findings; and
31/31 previously recorded Shannon transaction receipts independently verify.
The final post-change funded validation is recorded in `test/reports/`.

## Problem

Rolling Event Contract windows are short-lived and may open without a useful
book. Human market makers cannot reliably discover, price, quote, reprice,
settle, claim, and roll every window at machine cadence. Empty openings reduce
price discovery precisely when a new market needs an anchor.

## Novelty

TEMPO turns each market birth into an opening auction. It combines an
independent reference-price estimator, two economically distinct agents,
on-chain lifecycle automation, learned calibration from resolved outcomes, and
receipt-level verification. This is a new automated market behavior, not a UI
over a generic trade API.

## Why Somnia

Somnia's live log tail, reactivity path, fast blocks, and one-round-trip
transaction submission make continuous on-chain quoting practical. Removing
that execution and event cadence turns TEMPO into a slow polling bot and loses
the intended opening mechanism.

## Why DreamDEX

DreamDEX supplies the per-market CLOB, one-book/two-outcome model, opening
boundary, mint/burn pair inventory, live tick/lot parameters, explicit order
expiry, finalized registry, and redemption flow. Those mechanics define
GENESIS and VECTOR; replacing them changes the product rather than its adapter.

## Why Event Contracts

Market birth, a binary opening boundary, expiry, oracle resolution, void
handling, claim, and successor roll are load-bearing. Without rolling Event
Contracts, TEMPO has no opening auction or lifecycle to operate.

## Why AI

The appraiser produces an observable **MODEL ESTIMATE** from real feed history,
spot, opening boundary, realized volatility, and time remaining. A learned
temperature-calibration model fits Brier loss over the latest 30 resolved
windows and materially changes the uncertainty multiplier used by subsequent
decisions. VECTOR's edge threshold is also adjusted from its real settlement
direction. Model name, version, configuration, input-window fingerprint, and
before/after scores are journaled. Deterministic risk, authorization, and chain
truth remain outside the model, so learning cannot override safety caps.

## Why MCP

The stdio MCP server lets an external agent discover and inspect real Tempo
markets, books, estimates, risk, positions, settlements, activity, and receipts
through bounded structured tools. `place_order` is not advertised unless both
`TEMPO_MCP_WRITES=true` and a signer are present. Enabled writes use the same
chain-gated `Executor`; MCP never accepts a private key or arbitrary target.

## Architecture

```text
official feed / indexer / RPC / Somnia logs
                  |
        @tempo/core SDK
 exchange + estimate + calibration + risk + quantization
                  |
          @tempo/engine
 lifecycle + GENESIS + VECTOR + Executor + journal
          /              |               \
       CLI            MCP stdio       HTTP/SSE + web
```

`@tempo/core` owns shared domain behavior. The engine, CLI, MCP adapter, and
wallet preparation path consume it rather than duplicating economic logic.
`@somnia-chain/markets-sdk` is pinned exactly at `0.29.0`.

## GENESIS

GENESIS is the maker on its own key. It creates a two-sided opening anchor,
uses post-only orders, derives grids from the live pool, adapts spread and
inventory skew, cancels stale quotes, and stops at the endgame boundary.

## VECTOR

VECTOR is the taker on a distinct key. It reads the materialized live book and
crosses only when the touch clears its calibrated estimate edge. It uses IOC,
caps collateral and size, and never leaves a remainder resting.

## Lifecycle

```text
BIRTH -> ANCHOR -> GENESIS -> REPRICE -> ENDGAME -> LOCK
      -> SETTLE -> CLAIM -> ROLL
```

State is keyed by `marketId`, never recycled pool address. Settled markets are
found in the finalized registry rather than the live list.

## Data Flow

Official price ticks and history plus the market opening boundary feed the
appraiser. The live book and on-chain balances feed agent policy and risk. A
validated plan reaches the Executor, which rechecks chain state and records the
receipt. Journal records drive the CLI, dashboard, reports, and verification.

## On-Chain Flow

Every trading write requires live on-chain status `1`, current tick and lot,
collateral decimals read from the token, valid nanosecond expiry, a signer, the
external RiskEngine verdict, and a non-reverted receipt. `TEMPO_PAUSED=true`
stops every write boundary immediately.

## Settlement

The claim sweep reads finalized markets and current on-chain resolution. It
redeems only the winner, or both outcomes at 0.5 for a void. A successful call
is recorded only after receipt validation; a losing-side call is never treated
as a payout.

## Wallet

The dashboard discovers EIP-6963 providers with `window.ethereum` fallback.
Network metadata comes from the active server configuration. Preparation
rechecks trading status and risk, reads collateral/native balances, constructs
official SDK calls, and validates every destination against configured protocol
addresses and live market contracts.

## Connect Wallet

`Review IOC` displays account, network, market, side, size, limit, expiry,
worst-case cost, available collateral, destinations, and native value. It does
**not** sign. The user must select `Confirm in wallet` separately. Account or
network changes, cancellation, disconnects, insufficient funds, expired calls,
bad destinations, malformed hashes, and reverted/malformed receipts fail
closed. Agent keys never enter the browser.

## Security

TEMPO has no database or SQL layer, so SQL injection has no application surface.
Relevant boundaries are hardened instead:

- Loopback bind by default, GET-only routes, Host and same-origin enforcement.
- CSP, frame denial, MIME-sniff prevention, origin isolation, and no-referrer.
- URL/header/request-rate and SSE client bounds; static path containment.
- Zod MCP schemas, 16 KiB argument limit, 10-second timeout, tool allowlist.
- Recursive credential redaction and browser HTML/URL output encoding.
- Exact SDK pin, strict TypeScript, npm audit, and repository secret scan in CI.
- No key in snapshots, reports, browser state, MCP arguments, or errors.
- Emergency `TEMPO_PAUSED` kill switch and read-only/dry-run defaults.

The project deploys no custom contracts; contract-level reentrancy and admin
analysis are therefore `N/A`. Protocol contracts remain the official
DreamDEX/Somnia deployment. See [Security Operations](docs/SECURITY.md).

## Risk Controls

The shared `RiskEngine` enforces probability bounds, lot-positive size,
per-order collateral, net/gross inventory, firm capital, open-order count,
realized loss, time-to-expiry, and VECTOR edge. Configuration has numeric and
cross-field bounds. Risk caps are never learned or model-controlled.

## Zero-Mock

Production prices, books, status, balances, fills, settlements, and hashes come
from official services or chain reads. Estimates are deterministic/learned math
over those real inputs and are labeled. Missing state remains `UNAVAILABLE`,
`PENDING`, or `NO DATA`. Tests use mathematical cases but production has no
fixture or intercepted-network fallback.

## Provenance

| Value | Classification | Source |
| --- | --- | --- |
| Spot / EMA | fact | official Somnia price feed |
| Opening / status / grid | fact | DreamDEX indexer plus on-chain read |
| Book / fills | fact | markets SDK Somnia log tail |
| Balances | fact | collateral ERC-20 and outcome ERC-6909 |
| Settlement | fact | finalized registry, chain, oracle link |
| Fair value / sigma | MODEL ESTIMATE | documented real-time fair-value engine over real inputs |
| Inventory / P&L | derived | real fills and settlement |

## Observability

Every new record receives an `eventId`; decisions receive a `decisionId` that
correlates plans and execution. Records can include agent, source, market ID,
contract address, model/config version, block, transaction hash, and exact
inputs. JSONL replay is deterministic and `tempo verify` rechecks hashes by RPC.

## CLI

```text
tempo doctor                         tempo markets
tempo watch [--asset BTC]            tempo book <fragment>
tempo agents                         tempo positions
tempo firm simulate|start            tempo trade <ref> <up|down> <qty>
tempo claims [--claim]               tempo settlements [--limit N]
tempo activity [--n N]               tempo verify
tempo backtest [--limit N]           tempo report [--since 24h] [--llm]
tempo calibrate [--force]            tempo mcp
tempo faucet
```

Run with `npm run cli -- <command>`. Write commands fail without an authorized
signer and when the pause switch is active.

## Node.js SDK

`@tempo/core` is a Node 20+ ESM package with TypeScript declarations, package
README, changelog, MIT license, checksum, and SBOM. The GitHub release is tagged
`sdk-v0.3.0`.

## SDK Install And Examples

```bash
npm install https://github.com/Kevincruz2005/Tempo/releases/download/sdk-v0.3.0/tempo-core-0.3.0.tgz
```

```ts
import { loadConfig, TempoExchange } from "@tempo/core";

const exchange = new TempoExchange({ config: loadConfig() });
const [market] = await exchange.markets();
if (!market) throw new Error("NO DATA");
const state = await exchange.onchain(market.marketId);
const opening = await exchange.openingPrice(market.marketId);
console.log({ market, state, opening });
await exchange.close();
```

The artifact URL becomes anonymously installable after the repository is made
public. Full API details are in the [developer portal](packages/web/public/docs.html).

## MCP

```bash
npm run cli -- mcp
```

Read tools return JSON text plus MCP `structuredContent`. All calls are bounded
and journaled as agent `MCP` using a SHA-256 argument fingerprint. The write
tool is absent by default.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | cheap deterministic liveness |
| `GET /ready` | live indexer/RPC/feed/tail readiness |
| `GET /api/state` | bounded sanitized firm snapshot |
| `GET /api/stream` | journal-backed SSE |
| `GET /api/journal?n=N` | bounded recent records |
| `GET /api/provenance` | data-source map |
| `GET /api/wallet/config` | safe active-chain wallet metadata |
| `GET /api/wallet/activity` | address-attributed live fills/orders |
| `GET /api/wallet/prepare` | unsigned validated wallet calls |

## Health

`GET /health` returns only status, service, and package version. It performs no
chain, market, or AI operation and never exposes environment state.

## Readiness

`GET /ready` checks the real indexer, advancing RPC head, configured price
feeds, and SDK tail once requested. It returns `200` only when ready and `503`
otherwise; optional narrative generation never affects readiness.

## Web App

`npm run firm` serves the fixed-viewport live operator dashboard and
`/docs.html` on `http://127.0.0.1:7333`. Market activity shown in the UI is
journal or chain backed; no decorative fake trades are generated.

## Configuration

Copy `.env.example`. All values are validated and official endpoints are the
defaults. Controls include `TEMPO_NETWORK`, `TEMPO_DRY_RUN`, `TEMPO_PAUSED`,
agent keys, `TEMPO_MCP_WRITES`, endpoint overrides, asset/journal/host settings,
and all documented `TEMPO_*` risk limits. Never pass secrets on CLI arguments
or commit `.env`.

## Testnet

Use Somnia Shannon chain `50312`. Fund both distinct agent accounts with STT,
then use `npm run faucet` for official test collateral. Run the live probe
before writes and treat its output as ground truth. Venue IDs are discovered,
not silently hardcoded.

## Full On-Chain Mode

```bash
npx tsx probe/live-probe.ts
TEMPO_DRY_RUN=false npm run test:contract
TEMPO_DRY_RUN=false npm run test:e2e
npm run cli -- verify
```

The path is discovery -> state -> real data -> decision -> real order ->
receipt -> fill/state change -> settlement -> claim -> independent verification.

## Testing

```bash
npm test
npm run test:coverage
npm run test:live
npm run test:chain-gate
npm run test:mcp-live
npm run test:cli-live
npm run security:check
```

## 2,000+ Evidence

The offline suite currently runs 2,107 named cases. The 2,048-case invariant
matrix spans 6- and 18-decimal grids, boundary probabilities, and raw/human/raw
round trips; remaining tests directly cover config, wallet, calibration, MCP,
health, HTTP, security, failure, policy, ledger, report, and CLI behavior. The
distribution is driven by applicable risk, not artificial per-folder quotas.

## Security Evidence

CI runs secret scanning, strict package type checks, offline tests, an 85%
critical-core coverage threshold, high-severity dependency audit, and SDK
package dry-run. The current manual/security report is
`test/reports/security.md`.

## Live Transactions

Real transaction hashes and independently checked receipt statuses are listed
in `test/reports/full-onchain-mode.md`, `test/reports/contract-live.md`, and
`test/reports/verify-20260902.md`. Failed/reverted transactions are not counted
as successes.

## Reproducibility

```bash
git clone https://github.com/Kevincruz2005/Tempo.git
cd Tempo
npm ci
cp .env.example .env
npm run security:check
npm test
npm run firm
```

Anonymous clone works after repository visibility is changed to public. A local
clean-clone proof is recorded separately without copying secrets.

## Demo

The demo shows live rolling windows, estimate provenance, distinct agent
decisions, wallet review, journal correlation, settlement, and verified funded
hashes. Recording commands and checksums are under `test/reports/`.

## Project Structure

```text
packages/core     reusable SDK and safety primitives
packages/engine   agents, lifecycle, Executor, HTTP/SSE
packages/cli      operator CLI
packages/mcp      external agent tools
packages/web      dashboard and developer documentation
probe             known-good live connectivity probe
test              offline/live runners, artifacts, reports
docs              design, security, final build record
```

## Development

Use Node 20+, `npm ci`, `npm run typecheck`, `npm test`, and
`npm run test:coverage`. Preserve exact SDK `0.29.0`, zero-mock behavior, and
chain gating for every write. Do not add writes outside the core exchange and
engine Executor boundaries.

## Deployment

The built-in service is local/operator scoped. A remote deployment must keep
TEMPO behind authenticated TLS ingress, retain a loopback upstream bind, use
scoped operator keys, and expose only intended dashboard routes. The public
hosted endpoint remains blocked until repository/deployment visibility is an
explicit operator action.

## Troubleshooting

- No markets: run the live probe, inspect the discovered venue ID, then check
  indexer and RPC readiness.
- `NO DATA`: wait for sufficient official feed history; do not set a fallback.
- `MARKET_NOT_TRADING`: select a new live window; the chain gate is working.
- `PostOnlyWouldCross`: the book moved; GENESIS will reprice.
- Wallet blocked: check active chain, collateral/STT, expiry, and review state.
- `TEMPO_PAUSED`: an operator activated the emergency write stop.

## Failure Handling

Typed failures cover missing keys, unavailable dependencies, closed/expired
markets, grid errors, risk rejection, unfilled/reverted orders, and unavailable
receipts. Network gaps never become zero-valued market facts. Post-only crossing
is a reprice event, while ambiguous receipts fail closed.

## Limitations

Liquidity and collateral are testnet constrained. Indexer data may lag chain
state. Learned calibration requires resolved real windows. Public GitHub and
hosted documentation depend on the operator making the repository public. A
real injected-wallet screenshot requires a human wallet session and is not
fabricated by automation.

## Roadmap

Production work includes scoped Somnia operator/session authorization, audited
remote ingress, deeper calibrated history, multi-asset series, and mainnet
activation only after addresses/feed configuration are independently verified.

## Competitive Differentiation

Compared with a quote-only EC bot, TEMPO adds birth anchoring, a separate-key
taker, a complete settlement/claim/roll lifecycle, learned outcome calibration,
human wallet review, MCP interoperability, and receipt-correlated observability.

## Product Potential

The service can become shared opening infrastructure for short-lived event
series: venue-sponsored liquidity, strategy SDKs, agent-operated market desks,
and verifiable calibration analytics. Its defensibility is operational history
and safe lifecycle automation rather than a frontend skin.

## License

MIT. See [LICENSE](LICENSE).

## Evidence Links

- [Final checklist](test/reports/final-checklist.md)
- [Submission gate](test/reports/submission-gate.md)
- [Full on-chain evidence](test/reports/full-onchain-mode.md)
- [MCP live evidence](test/reports/mcp-live.md)
- [Wallet evidence](test/reports/wallet-flow.md)
- [Health/readiness evidence](test/reports/health-endpoint.md)
- [Security evidence](test/reports/security.md)
- [SDK release evidence](test/reports/release.md)
- [40-section final record](docs/FINAL.md)
- [Developer documentation](packages/web/public/docs.html)
