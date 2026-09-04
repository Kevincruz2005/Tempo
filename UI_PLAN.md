# TEMPO UI/UX — Completion Plan (v2)

> **This file completes `docs/UI-BASE-PLAN.md`.** The base plan defines product
> structure, pages, and philosophy (sections 1–34). This document fills every
> remaining gap so Codex can implement the #1-caliber UI without guessing:
>
> - A. Design system (tokens, colors, type, density) — base §24 says *what*, this says *exactly*
> - B. Component inventory with honest states — base §22 generalized, this enumerates
> - C. Provenance badge matrix — base §5 list, this is the full spec
> - D. Honest-state copy table — every string, verbatim
> - E. Pricing & commercial tiers — **fully detailed** (base §17/§18 were stubs)
> - F. Public deployment plan — judges get a live URL, not localhost
> - G. Accessibility & keyboard map — base §20 said "must work", this specifies how
> - H. Performance budget
> - I. Page wireframes (desktop + mobile)
> - J. Terminology sync — reconcile base §4 language with README/SUBMISSION
> - K. Evidence numbers policy — base §32, operationalized
> - L. Implementation order with estimates (extends base §30)
>
> **Hard constraints from base §31 apply throughout.** Real data only; no fake
> checkout/users/metrics; LLM never controls anything; RiskEngine unbypassable.

---

## A. Design System — exact tokens

### Color (dark-first; v1 ships dark only)

```css
:root {
  /* surfaces */
  --bg-0: #0A0D13;        /* app background */
  --bg-1: #0F141C;        /* panels */
  --bg-2: #151C26;        /* raised: drawers, modals, popovers */
  --bg-3: #1C2530;        /* hover fill */
  --line-0: #1E2733;      /* panel borders */
  --line-1: #2A3542;      /* input borders, dividers */

  /* text */
  --tx-0: #E8EDF2;        /* primary */
  --tx-1: #9AA7B4;        /* secondary */
  --tx-2: #5C6B7A;        /* tertiary/labels */

  /* brand + market semantics */
  --accent: #6E8BFF;      /* TEMPO brand — calm institutional blue-violet */
  --accent-dim: #3D5180;
  --up: #2FBF71;          /* UP / winning / ok */
  --down: #E5484D;        /* DOWN / losing / breach */
  --warn: #F5A524;        /* near-limit risk */

  /* provenance badges (base §5) */
  --prov-chain: #2FBF71;    /* CHAIN FACT */
  --prov-model: #F5A524;    /* MODEL ESTIMATE */
  --prov-policy: #5EA3EF;   /* POLICY */
  --prov-derived: #8B98A5;  /* DERIVED */
  --prov-llm: #A78BFA;      /* LLM COMMENTARY */
}
```

Rules: accent is used for *navigation state and primary actions only* — never
for data. Data color comes from semantics (up/down) or provenance. Gradients:
none. Glow: none. The observatory must read as infrastructure, not as a
screensaver (base §24).

### Typography

| Role | Family | Notes |
|---|---|---|
| UI text | `Inter, system-ui, sans-serif` | 400/600 weights only |
| Numerics, hashes, prices, tape | `JetBrains Mono, ui-monospace, monospace` | tabular figures; hashes always mono, always truncated with full value in tooltip/drawer |
| Provenance badges / labels | Inter 600, 10px, letter-spacing 0.08em, UPPERCASE | |

Scale (desktop): 24/20/16/14/12/10. Mobile: same minus one step at ≥24.

### Density & spacing

- Two densities (base §20): Comfortable (8px base grid, 16px panel padding) and
  Compact (4px grid, 10px padding). Persisted in localStorage; default Compact
  on ≥1440px width, Comfortable below.
- Radii: 6px panels, 4px inputs/badges. Shadows: single soft elevation for
  drawers/modals only.
- Motion tokens: 120ms ease-out standard, 240ms for drawer/modal; **all motion
  behind `@media (prefers-reduced-motion: no-preference)`** (base §25: must be
  understandable with animation disabled).

---

## B. Component inventory (each with 4 honest states per base §22)

| Component | Used on | States: loading / empty / pending / error |
|---|---|---|
| `NetworkPill` | header | `Connecting…` / n/a / `Reconnecting` / `OFFLINE` (red dot, tooltip: engine unreachable) |
| `LifecycleBar` | landing, dashboard, markets | skeleton bars / `NO ACTIVE WINDOW` / stage pulse / n/a |
| `StatCard` | dashboard, landing proof strip | skeleton / `NO DATA` / `PENDING` / `UNAVAILABLE` |
| `AgentCard` | dashboard | skeleton / `IDLE` / `QUOTING`,`WATCHING`,`ACTING` / last-error line (verbatim journal reason) |
| `RiskTable` | dashboard | skeleton / `NO DATA` / per-control `AT LIMIT` (warn) / n/a |
| `MarketRow` | markets | skeleton / `NO BOOK` (honest — this is the product's premise!) / `PENDING` (strike not yet published) / `UNAVAILABLE` |
| `BookLadder` | markets inline expansion | skeleton / `EMPTY BOOK — awaiting genesis` / streaming / n/a |
| `FairValueGauge` | markets expansion | skeleton / `NO DATA` (fewer than min σ samples — never 50%) / band + point / n/a |
| `ActivityRow` | dashboard tape, history | n/a / `NO EVENTS YET` / `PENDING RECEIPT` / error badge with journal reason |
| `TxDrawer` | everywhere a hash appears | fetch receipt: spinner / `NOT FOUND` (red — investigated, never hidden) / `PENDING RECEIPT` / verified block+status |
| `BriefingCard` | dashboard (below risk, base §12) | `LLM narration not configured — deterministic mode` / `NO BRIEFING YET` / generating / generation error (plain) |
| `PricingModal` | nav "Pricing" | static content; `AVAILABLE` vs `PLANNED` chips only; waitlist CTA (mailto), **no fake checkout** |
| `SettingsPopover` | gear | persisted; no secrets fields, ever |

Implementation note: **stay vanilla** (existing `app.js`/ES-module pattern, hash
router for the 5 pages). No framework addition — budget in §H depends on it.

---

## C. Provenance badge matrix (authoritative)

| Label | Color | Tooltip (exact) | Sources |
|---|---|---|---|
| `CHAIN FACT` | green | "Read directly from Somnia (RPC/contract read or chain-event tail)" | market status, strike, balances, receipts, fills, settlements |
| `MODEL ESTIMATE` | amber | "Computed by TEMPO's real-time fair-value engine from live inputs; an estimate, not a fact" | fair value + band, σ, taker-edge assessments |
| `POLICY` | blue | "Value set by operator policy/config" | risk caps, quote size, half-spread, calibration bounds |
| `DERIVED` | gray | "Calculated from sourced inputs" | counts, uptime, tape aggregations, report stats |
| `LLM COMMENTARY` | violet, *italic body* | "Generated from journal facts. Does not control pricing, risk, or execution." | briefing only |
| `JOURNAL EVENT` | outline style | "Recorded by TEMPO's journal; not independently chain-verified" | history filter distinction (base §15) |

One badge per datum, placed immediately after the value, never in a footer
legend alone.

---

## D. Honest-state copy table (verbatim — no synonyms)

```
Loading…                     (skeleton + this label)
NO DATA                      (nothing exists yet)
UNAVAILABLE                  (source unreachable — includes retry affordance)
PENDING                      (awaiting chain/indexer)
PENDING RECEIPT              (tx sent, receipt not yet confirmed)
NOT FOUND                    (receipt lookup failed — shown red, clickable to explorer)
EMPTY BOOK — awaiting genesis (the product's premise, shown proudly)
LLM narration not configured — deterministic mode
```

Never: fake zeros, 50% fill-ins, dummy hashes, lorem, "—" for values that
should exist.

---

## E. Pricing & Commercial Offering — **complete detail** (fills base §17/§18)

### Positioning line (top of modal)

> **TEMPO's engine is free to observe. The firm earns from markets, not from
> screenshots.** Spread capture + DreamDEX's zero-fee maker yield fund the
> firm's own operation; software tiers exist for people who want to *operate*
> TEMPO-class infrastructure themselves.

### The Standard | LLM-Enhanced toggle (base §17) — concretely

| | **Standard** (default) | **LLM-Enhanced** |
|---|---|---|
| Market state, fair value, risk, tape, settlements, docs, SDK | ✅ identical | ✅ identical |
| Operator Briefing (base §12) | hidden | ✅ |
| Market commentary on expansion panels | hidden | ✅ (clearly `LLM COMMENTARY`) |
| `tempo report` narration | deterministic only | ✅ `--llm` |
| Configuration | none needed | bring-your-own key (`TEMPO_LLM_API_KEY`) |
| Boundary banner | — | always shown: *"LLM output does not control pricing, risk, or execution."* |
| No key set | — | toggle disabled with: `LLM narration not configured — deterministic mode` |

### Tier 1 — Free Explorer · **AVAILABLE NOW**

Everything a judge or trader needs to watch the firm operate:

- Live observatory (all 5 pages), public, no wallet required (base §28)
- Real-time windows, books, fair-value bands, lifecycle bars
- Risk panel + activity tape + History + TxDrawer verification
- Settlement feed with oracle-explorer links
- `tempo` CLI (15 commands), `@tempo/core` SDK, MCP server, docs
- Limited LLM briefings (if a key is configured by the host: 3/day)

**Price: Free. Forever.** CTA: none needed — it's the product.

### Tier 2 — Pro Operator · **PLANNED (post-hackathon)**

For teams who want to *run their own firm* rather than watch ours:

- **Orchestration console** — start/stop/pause your firm from the UI (same
  engine, same RiskEngine; UI never bypasses it)
- **Configurable risk profiles** — named presets (Conservative/Balanced/
  Aggressive) mapped to the existing `TEMPO_*` caps; live "what would change"
  preview before applying
- **Wallet-connected human trading** — prepare → pre-sign summary → sign,
  through the same RiskEngine path (base §21)
- **Alerting** — Telegram/Discord webhooks on: risk-limit binds, fills,
  settlement voids, feed outages (all events already journaled — this is a
  delivery layer, not new logic)
- **Advanced monitoring** — Brier trend chart across calibration epochs,
  per-window P&L attribution from the ledger, error-taxonomy dashboard
- **SDK/API access** — stable read API over the same `/api/*` surface with an
  issued key + documented rate limits
- Priority journal retention (90 days vs 14)

**Planned price: $49/operator/month or 0.05% of routed notional (whichever is
lower) — payable in USDso.** *Marked PLANNED. CTA: "Join waitlist" → mailto +
Discord invite. No checkout, no fake subscribe, no fake counters (base §18).*

### Tier 3 — Enterprise / Venue · **PLANNED**

For venues and desks that want opening-auction liquidity as a service:

- Dedicated deployment (their keys, their risk envelope, their venue scope)
- Custom risk controls + compliance reporting (journal exports, SBOM, audit trail)
- Private monitoring plane + SSO
- Mainnet operation (config switch today; operational runbooks + key ceremony
  docs at engagement start)
- Custom integrations (additional venues, Data-Streams anchor feeds, MCP tool sets)

**Planned pricing: custom.** CTA: "Contact" → mailto. No fake enterprise logo
wall, no fake customer count.

### Why judges should believe the model (one paragraph, shown in modal footer)

> TEMPO's own P&L is structural: captured spread plus DreamDEX's
> proximity-weighted maker yield on resting quotes, at zero venue fees. The
> software tiers monetize *operation* of the primitive, not access to data —
> observation stays free because a public, verifiable observatory is the
> product's best marketing.

---

## F. Public deployment plan — the judge-facing URL

**Problem:** base plan assumes the observatory; today it binds `localhost:7333`.
Judges must not be asked to run anything (base §28).

**Plan (matches the Wardens-Pattern infra already owned — Azure VM + PM2):**

1. **Engine on the existing Azure VM** — `pm2 start` the firm (read-only or
   dry-run mode is acceptable for the public instance; the funded evidence
   lives in the repo reports), Nginx reverse-proxy `443 → 7333` with TLS
   (Let's Encrypt) at e.g. `tempo.<your-domain>` or the VM IP.
   Already-present protections make this safe: host-header allowlist,
   same-origin enforcement, API rate limiting, zero key material in responses.
2. **Landing as static** — the landing page + docs can also deploy to Vercel/
   GitHub Pages linking into the observatory URL.
3. **Health**: `GET /health` for uptime checks; `GET /ready` reflects indexer/
   RPC/feed reachability — wire an UptimeRobot (or PM2 health) check so the
   public URL being down on judging day is detected immediately.
4. **Ops rules**: public instance runs `TEMPO_DRY_RUN=true` **or** live with
   small caps (operator's choice); either way the UI shows the true mode in
   the header (`LIVE` red dot / `DRY-RUN` gray dot) — never ambiguous.
5. **Fallback** if the VM path fails: submit with landing on Vercel +
   "Open Observatory" downloads/one-command run instructions prominently —
   but the VM path is strongly preferred and uses infrastructure you already
   run.

Add the public URL to: README header links, SUBMISSION.md live links, DoraHacks
BUIDL, and the demo video outro card.

---

## G. Accessibility & interaction spec (base §20/§23 executable)

- **Keyboard map:** `1–5` switch pages; `/` focuses Markets filter; `j/k`
  move tape/history cursor; `Enter` opens TxDrawer; `Esc` closes drawer/modal/
  popover; `?` opens shortcut sheet. Focus visible on every interactive
  element (`:focus-visible` ring using `--accent`).
- **ARIA:** activity tape `role="log" aria-live="polite"`; TxDrawer
  `role="dialog"` + focus trap + return focus on close; badges carry their
  tooltip text as `aria-label`; lifecycle stages `aria-current="step"`.
- **Contrast:** all text ≥ 4.5:1, badges ≥ 3:1 against their chip background —
  verify tokens in §A (they were chosen to pass) with an automated axe pass in
  the CI script.
- **Touch targets ≥ 44px** on mobile; tape rows and market rows have explicit
  expand buttons (never hover-only — base §20).
- **Reduced motion:** every animation is decorative-layer only; lifecycle
  state must be fully legible statically (check/stage glyphs, not just pulses).

---

## H. Performance budget (vanilla stack, no framework — keep it)

| Metric | Budget |
|---|---|
| Landing first render | < 1.5s on 4G; JS ≤ 20KB gz |
| Observatory app.js total | ≤ 40KB gz (current pattern fits; do not add deps) |
| /api/state poll | 2s interval, ≤ 8KB payload (already true) |
| SSE | 1 connection; auto-reconnect w/ 2s backoff; heartbeat per existing server |
| Fonts | system-first; JetBrains Mono via `font-display: swap` subset |
| Lighthouse (landing, desktop) | Perf ≥ 95, A11y ≥ 95, Best Practices ≥ 100 |

CI check: `node --check` on all public JS (already in the security script) +
a size assertion script in `test/scripts/`.

---

## I. Wireframes

### Landing (desktop)

```
┌────────────────────────────────────────────────────────────┐
│ TEMPO                                        Somnia 50312 ●│
│                                                            │
│        Every Event Contract is born with an empty book.    │
│   TEMPO is the autonomous opening-auction layer for        │
│   DreamDEX Event Contracts on Somnia.                      │
│        [ Open Observatory ]   [ Connect Wallet ]           │
│                                                            │
│  BIRTH→ANCHOR→FAIR VALUE→ACTION→REPRICE→ENDGAME→SETTLE→    │
│  CLAIM→ROLL                          (animated, 1 line)    │
├────────────────────────────────────────────────────────────┤
│  369 windows  6,274 decisions  120 tx hashes  2,107 tests  │
│      31/31 funded validation transactions verified         │
│                    0 mocked economic values                │
├──────────────┬──────────────┬──────────────────────────────┤
│ MARKET BIRTH │ AUTONOMOUS   │ VERIFIABLE                   │
│ empty books  │ LIQUIDITY    │ EXECUTION                    │
│ (3 cards per base §6)                                      │
└──────────────┴──────────────┴──────────────────────────────┘
```

### Dashboard (desktop ≥1200, 12-col)

```
┌ header: TEMPO | Dashboard | Markets | History | Docs | ⚙ | pill | wallet ┐
├──────────────────────────────────────────────────────────────────────────┤
│ [Live Markets: 14] [GENESIS: QUOTING] [VECTOR: WATCHING] [Risk: SAFE]    │
├──────────────────────────────── 8 col ─────┬───────────── 4 col ─────────┤
│ BTC · 1M     REPRICE                       │ RISK ENGINE (table)         │
│ BIRTH✓ ANCHOR✓ FAIR✓ ACTION✓ REPRICE● …    │ Inventory   32/60           │
│ spot 77,405.2 [CHAIN] strike 77,501 [CHAIN]│ Collateral  412/2000        │
│ fair 41.2% [MODEL]  t 00:07:41             │ Tick/lot    ALIGNED         │
│ GENESIS → REQUOTE                          │ Expiry      OK             │
├────────────────────────────────────────────┤ ─ 1 rejected order:         │
│ ACTIVITY TAPE (role=log)                   │   inventory cap [JOURNAL]   │
│ 22:41:18 VECTOR IOC FILL [CHAIN] 0x3d2c…  │─────────────────────────────│
│ 22:41:02 GENESIS REQUOTE [MODEL]           │ OPERATOR BRIEFING           │
│ 22:40:55 CHAIN MARKET FINALIZED [CHAIN]    │ [LLM COMMENTARY] + boundary │
│            [Live View | Proof View] toggle │                             │
└────────────────────────────────────────────┴─────────────────────────────┘
```

### Markets / History / mobile stacks — per base §13/§15/§23 exactly; inline
expansion (base §14) and TxDrawer (base §16) as specced there. Mobile order:
market → agents → risk → activity → briefing (base §23).

---

## J. Terminology sync (do this at integration — one pass)

Base §4 canonical language vs. current repo docs:

| Repo currently says | Change to (base §4) | Where |
|---|---|---|
| `AI ESTIMATE` | `MODEL ESTIMATE` | README, SUBMISSION.md, dashboard badges, journal labels*, MCP `get_fair_value` |
| "AI agents" / "verifiable machine intelligence" | "autonomous trading agents" / keep the phrase but with MODEL ESTIMATE labels | README, SUBMISSION |
| `AI NARRATIVE` (report) | `LLM COMMENTARY` | report.ts label, README |

\* Journal record labels are historical data — leave old records as written;
change only the *emitting* labels and UI. Note the sync in the README
changelog line so evidence docs and UI never contradict each other silently.

---

## K. Evidence numbers policy (base §32 operationalized)

- **Current** (live-run derived, shown by default): Brier **0.1093** / **6**
  scored markets / **83.3%** directional; 369 windows; 6,274 decisions; 168
  orders; 120 hashes; 10 fills; 3 claims; 31/31 verified; 2,107 tests.
- **Historical** (only where explicitly marked `HISTORICAL — 2026-09-02 run`):
  Brier 0.0723 / 3 markets / 100%.
- Landing proof strip: hardcode **only** with a `as of 2026-09-0X` caption;
  Dashboard/History: read live from `/api/state` + reports — **never hardcode
  into components**.
- If the firm runs again before submission, regenerate
  `tempo report --out test/reports/firm-report-latest.md` and update the strip.

---

## L. Implementation order (extends base §30; ~3–4 focused days)

**Day 1 (P0 core):** hash-router + 5-page shell (A tokens, header/nav) →
Dashboard re-layout (status row, lifecycle card, agent cards, risk panel,
tape) → provenance badges everywhere (C/D). *Gate: `npm test` + `tsc` green;
dashboard still consumes existing `/api/*` only.*

**Day 2 (P0/P1):** Markets page + inline expansion + BookLadder +
FairValueGauge → Landing (static) → History + TxDrawer → Live|Proof toggle.

**Day 3 (P1):** PricingModal with §E content verbatim → Settings popover →
LLM Briefing card → Docs page (link-out per base §19) → terminology sync (J).

**Day 4 (P2 + ship):** lifecycle animation + polish → a11y pass (G) → perf
budget check (H) → **public deployment (F)** → screenshots refresh → commit/
push → record the 2–3 min demo against the public URL.

**Definition of done:** every base-§31 constraint verified; every component
exercises its 4 honest states (screenshot the empty/pending states by pointing
at a stale market); public URL live with `/health` monitoring; zero new
runtime dependencies.
