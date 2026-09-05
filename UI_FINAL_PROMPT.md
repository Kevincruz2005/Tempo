# PROMPT — TEMPO Web UI: Final Delta Pass (grounded in the shipped code)

> **Read this whole file before touching anything.** The multi-page observatory
> is ALREADY BUILT in `packages/web/public/` (`index.html`, `app.js` ~1,267
> lines, `styles.css`, `wallet.js`, `security.js`, `docs.*`). Your job is a
> **completion delta**, not a rebuild. If you find yourself rewriting a
> renderer that already exists and works, stop — you have misread this prompt.
>
> Merged source plans: `docs/UI-BASE-PLAN.md` (§1–34), `UIPlan (1).md`,
> `UI_PLAN.md` (v2 completion). Where they conflict with the shipped code, the
> **shipped code wins** unless this prompt explicitly changes it.

## 0. What already exists — DO NOT rebuild (verified in code)

- **7 routes via History API + `data-route`**: `/` landing, `/dashboard`,
  `/markets`, `/markets/:id` (deep-linkable market detail), `/history`,
  `/docs` (absorbs `docs.html` with sidebar TOC + search), `/pricing`, 404.
- **Persistent top nav on every page**: brand → Dashboard · Markets · History ·
  Docs · Pricing → network pill, LIVE/DRY-RUN pill, theme toggle, wallet
  button. Active state per route, document.title per route.
- **Canonical provenance badges** `chain/model/policy/derived/journal/llm`
  with exact labels (CHAIN FACT…LLM COMMENTARY) — matches base §4/§5.
- **Landing**: hero + reactor visual, lifecycle strip, 3 proof cards, live
  evidence strip (session counters, honest).
- **Dashboard**: venue pulse, market list with birth pulses, market preview
  (facts + book incl. the `EMPTY BOOK — awaiting genesis` hero + fair-value
  band), agents & risk panel with capped risk bars, evidence stream (tape +
  settlements + briefing), collapsible panel toggles, dashboard lifecycle
  progress panel.
- **Markets**: filter bar (search/state/asset/interval/sort incl. NO_BOOK),
  data table, recently finalized. **Market detail**: book depth 12, facts,
  SVG sparkline from official feed records, fair value + lifecycle, agents &
  risk decisions incl. rejects, lifecycle proof timeline, settlement, trade
  IOC entry.
- **History**: 7 tabs, 8 filters (agent/window/asset/interval/type/provenance/
  status/search), provenance + status columns, JOURNAL vs CHAIN separation.
- **Overlays**: command palette (with market search), wallet drawer
  (EIP-6963 picker → connect → activity → prepare → review IOC → confirm),
  proof drawer (tx), audit drawer (event/agent/risk, sanitized payload,
  correlated decision sequence), settings (density/refresh/asset/interval/
  theme/motion), shortcuts sheet, toasts. Focus management + skip link + aria.
- **Infrastructure**: SSE `/api/stream` with poll fallback, busy-UI re-render
  guard, scroll preservation, `/api/state` validation, escapeHtml/safeHttpsUrl
  on all interpolations, light + dark themes.

**Keep all of it.** These were better than the plans in places (pricing as a
full page matches the attachment-2 nav; market detail as a route beats inline
expansion; the audit drawer's correlated-decision view is a differentiator).

## 1. Hard constraints (unchanged, still binding)

Real data only; honest states verbatim (`NO DATA` / `UNAVAILABLE` / `PENDING`
/ `PENDING RECEIPT` / `NOT FOUND` / `NO EVENTS YET` / `EMPTY BOOK — awaiting
genesis`); no fabricated users/metrics/checkout; RiskEngine unbypassable
(wallet trades only via `/api/wallet/prepare`); no secrets in the browser;
LLM = `LLM COMMENTARY` narration only with boundary line; `npm test` (2,107)
+ `tsc` × 4 packages stay green; vanilla only, no new dependencies; all motion
respects `reduced-motion` + the settings toggle.

## 2. The delta — implement exactly these, nothing else

### D1. Landing: verified-evidence strip (base §6)
Below the existing live evidence strip, add one compact row of **campaign-
verified** figures with an `as of 2026-09-03 run · test/reports/` caption:
`369 windows · 6,274 decisions · 120 tx hashes · 2,107 tests` →
`31/31 funded validation transactions verified` → `0 mocked economic values`.
Hardcode ONLY these (they are historical report facts, captioned as such);
keep the live session counters above them. If a newer `firm-report-*.md`
exists at build time, use its numbers and update the caption date.

### D2. Dashboard: judge status row (base §7)
Insert 4 compact StatCards directly under the page header, above the grid:
`Live Markets` (count, CHAIN) · `GENESIS <state>` (QUOTING/IDLE/… from agent
state) · `VECTOR <state>` · `Risk WITHIN LIMITS / AT LIMIT` (derive: any
risk-reject in the last 5 min or any risk bar ≥100% → AT LIMIT, warn style).
Real values only; reuse `badge()`/`empty()`.

### D3. Dashboard: `Live View | Proof View` toggle (base §27)
Segmented control in the dashboard header (reuse `.segment-control`).
**Live View** = current layout. **Proof View** = same data, evidence-first:
auto-expand evidence panel + collapse venue/preview panels, filter the tape to
hash-bearing + risk-reject + settlement events, show lifecycle panel with
stage links into History. A toggle, not a route; persist in sessionStorage
like the pricing toggle.

### D4. Proof drawer: live on-chain receipt lookup
Add read-only `GET /api/receipt?hash=0x…` in `server.ts` → `eth_getTransactionReceipt`
via the existing public client → `{status, blockNumber, from, to}` or 404.
In `openProof()`: when the hash is outside the loaded journal (the existing
`NOT FOUND` branch), fetch this endpoint and render real status/block instead
of the static message; keep the honest `NOT FOUND` (red) only for genuinely
unknown hashes. Rate-limited like other `/api/*`. This mirrors `tempo verify`
in the UI — one click, any hash, real chain answer.

### D5. Mobile navigation check (base §3)
Verify `<768px`: primary nav must collapse to the ☰ sheet containing
Dashboard/Markets/History/Docs/Pricing + network + mode pills; wallet button
stays visible. If `.primary-nav` currently just wraps/scrolls horizontally,
add the sheet (reuse the command-overlay markup pattern). Mobile stack order
per base §23 already holds via CSS — confirm, don't redesign.

### D6. Color tokens — operator-owned palette (user instruction)
Consolidate every color in `styles.css` (both themes) into ONE clearly
commented block at the top:
`/* ══ OPERATOR PALETTE — edit freely; nothing else in this file sets color ══ */`
Semantic custom properties only (bg/surface/line/text×3/accent/up/down/warn/
prov-*). Hunt and replace all remaining hardcoded hex/rgb outside that block
(including `meta[name=theme-color]` values in `app.js` — read them from the
token block via getComputedStyle at theme apply). The current light+dark pair
ships as defaults; the operator may retune freely without touching logic.

### D7. Keyboard legend truthing
The shortcuts sheet says `1–7` pages — wire keys to reality: `1` dashboard,
`2` markets, `3` history, `4` docs, `5` pricing, `0` or `g` landing; `/`
focuses the page's search input when present; `j/k` row cursor where rows
exist (already partially wired); `c` command palette; `?` sheet. Update the
sheet legend to match exactly what is bound.

### D8. Accessibility + evidence capture
Run axe (devDependency already absent — use `npx axe-cli` ad hoc or a bookmarklet
run; do NOT add a runtime dependency) on all 7 routes in both themes; fix
findings (expected: focus trap completeness in drawers, table caption/aria on
data tables, `aria-current` on nav). Then screenshot every honest state you
can produce honestly (empty book, NO DATA fair value, PENDING receipt, NO
EVENTS YET, NOT FOUND hash, UNAVAILABLE engine-off) into
`test/reports/ui-states/` with a one-line index md naming the state + how it
was produced. No staged/faked data to force a state — use stale markets and
engine-off captures.

### D9. Final gates
`node --check` all public JS; cold-load each route with the firm running;
`npm test` + `tsc` green; no new dependencies; update `test/reports/`
`ui-states` index; add a two-line changelog note in README (terminology:
labels are already canonical — note the receipt-lookup addition).

## 3. Build order

D6 (tokens first — everything else styles cleanly against final tokens) →
D2 → D3 → D1 → D4 → D5 → D7 → D8 → D9. One commit per delta, gate on D9 each
time. Total expected: well under a day of focused work.
