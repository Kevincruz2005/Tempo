# TEMPO — Final UI/UX Build Prompt

## Mission

Redesign the TEMPO web observatory into a prize-winning, production-quality interface for the Somnia × DreamDEX Event Contracts hackathon.

Build a serious autonomous-market control room: immediately understandable to a judge, useful to a trader, and credible to a protocol engineer. The interface must make four answers obvious:

1. What markets exist?
2. What is TEMPO doing right now?
3. Why did it act or stand down?
4. Where can the user verify it?

The product is a market observatory first, an execution console second, and an AI narration surface third.

Use the existing codebase and its real data. Do not invent, simulate, hardcode, hide, or cosmetically imply users, volume, TVL, revenue, P&L, fills, market depth, transactions, uptime, AI capability, or performance.

The user will decide the final color palette. Define semantic color roles and component states, but do not spend this plan on choosing final colors.

---

## Non-negotiable product rules

- Preserve every currently existing feature.
- Separate each major page into its own route/view; do not collapse the whole product into one dashboard screen.
- Keep the primary navigation/menu permanently at the top on desktop and available from the top bar on mobile. It must work on every page, including docs, pricing, wallet states, error states, and deep links.
- Keep public observation available without a wallet. Require a wallet only for wallet-specific actions.
- Never let UI code bypass `RiskEngine`.
- LLM/Gemini is optional commentary only. It never controls pricing, risk, execution, order placement, or overrides.
- Every meaningful value must show provenance: `CHAIN FACT`, `MODEL ESTIMATE`, `POLICY`, `DERIVED`, `JOURNAL EVENT`, or `LLM COMMENTARY`.
- Never show fake zeros, dummy hashes, fake progress, or a misleading `50%` fair value when data is unavailable.
- Show `LIVE`, `DRY RUN`, `READ ONLY`, `POLL FALLBACK`, `UNAVAILABLE`, and `PENDING` exactly and prominently when applicable.
- Keep private keys, secrets, API keys, and signer details out of the browser UI and transport payloads.
- Prefer the existing vanilla HTML/CSS/ES-module architecture. Do not add a framework unless there is a compelling, documented reason.

## Existing functionality that must remain

Carry these current capabilities into the new page architecture without regression:

- Live market discovery and rolling windows for BTC/ETH and supported cadences.
- Selected-market detail: expiry, seconds left, status, strike/opening value, spot, venue, market ID.
- Live order book levels and touch from chain events/indexed state.
- Real-time fair value, confidence band, sigma, feed samples, and explanatory note.
- GENESIS and VECTOR agent cards with mode, address, collateral, realized P&L, inventory, fills, open orders, last action, and decision state.
- Risk state and limits, including clear rejection/bind explanations.
- Activity tape sourced from journal records and live SSE updates.
- Market-birth pulse and lifecycle changes.
- Settlements, winning outcome/void state, trade count, last price, and oracle audit link.
- Human wallet connection, wallet selection, network checks, account state, and wallet activity.
- Human IOC flow: select window, side, size, limit, review, confirm in wallet, cancel, and display result.
- Gemini briefing generation initiated by the user, with model/status/error/generation metadata and the non-control disclaimer.
- `/api/state`, `/api/journal`, `/api/narrative`, `/api/stream`, health/readiness behavior, and safe explorer links.
- Existing docs page and all technical/product/security documentation links.

If an API does not currently provide a field, render an honest unavailable state and document the missing field. Do not fabricate a replacement.

---

## Information architecture and routes

Use a shared application shell with independent page views:

```text
/              Landing / product explanation
/dashboard     Live command center
/markets       Market directory and inspection
/markets/:id   Dedicated market detail
/history       Audit trail: journal, orders, fills, settlements
/docs          Documentation hub and technical proof
/pricing       Commercial model / planned tiers
```

`/markets/:id` is a page, not merely a hidden expansion. It must remain linkable, refreshable, keyboard-accessible, and shareable. Agent, risk, settings, wallet review, transaction proof, and AI briefing remain contextual surfaces inside the relevant page rather than competing primary destinations.

### Global top shell — present everywhere

Top bar, sticky while scrolling:

```text
[TEMPO mark] [Dashboard] [Markets] [History] [Docs] [Pricing]
                                      [Network] [Mode] [Tail] [Wallet] [Menu]
```

- Active route is visually and semantically selected.
- Navigation is real links, not click-only buttons.
- Keep the brand compact; use the existing logo/identity assets.
- Network, runtime mode, live-tail status, and wallet state remain visible without opening a drawer.
- Add a compact global `Command menu` button on desktop and mobile. It opens from the top bar and provides every destination, market search, keyboard shortcuts, docs search, and safe actions.
- The menu must never cover the entire top navigation in a way that makes the current route unclear. Close on Escape, outside click, route change, or selection.
- On mobile, use a top-right menu drawer; never remove access to network/mode/wallet status.
- Do not rely on hover. Every menu, tooltip, popover, drawer, and disclosure works with click, touch, keyboard focus, and Escape.

### Global footer/status rail

Show compact links to repository, Somnia explorer, DreamDEX/oracle proof, security, and docs. Include:

`Every value carries provenance` · `MOCKED VALUES = 0` only when that value is sourced from the real audited application state; otherwise show an honest unavailable state.

---

## Page 1 — Landing

Purpose: explain the problem and earn the first click in under 20 seconds.

Layout:

1. Hero: “Every DreamDEX Event Contract is born with an empty book.”
2. Supporting statement: TEMPO is the autonomous opening auction and market-making layer for DreamDEX Event Contracts on Somnia.
3. Primary CTA: `Open Observatory` → `/dashboard`.
4. Secondary CTA: `Connect Wallet`.
5. Persistent network truth: `Somnia Shannon · Chain 50312` plus actual runtime mode.
6. Lifecycle visualization: `BIRTH → ANCHOR → FAIR VALUE → GENESIS → REPRICE → ENDGAME → SETTLE → CLAIM → ROLL`.
7. Three proof cards: market birth, autonomous liquidity, verifiable execution.
8. Evidence strip populated dynamically from verified state/reports, with date/window scope beside every metric.
9. A concise “How one window lives” panel with links into a real market detail page.
10. Final CTA: `Watch the live firm`.

Avoid dashboard clutter, pricing claims, fake social proof, and decorative animation that competes with the lifecycle explanation. The existing flow animation may be used as supporting media with reduced-motion support.

---

## Page 2 — Dashboard / Live command center

Purpose: show the full operating loop at a glance.

Above the fold, in this order:

1. **Venue pulse:** active windows, newest birth, nearest expiry, managed cadence count, chain/tail status.
2. **Agent pulse:** GENESIS and VECTOR status, last action, last decision, and mode.
3. **Risk pulse:** capital, inventory, open orders, caps, rejects, and current safety state.
4. **Selected market preview:** touch, fair-value estimate/band, seconds left, lifecycle, and `Inspect market` link.
5. **Activity tape:** journal → decision → transaction chronology, newest first, live SSE updates.
6. **Settlements:** latest finalized windows, outcome/void status, and oracle proof links.
7. **Operator briefing:** below facts and risk, never above them.

Use a responsive grid on wide screens and a clearly ordered single column on narrow screens. The dashboard should feel like one coherent operating story, not unrelated cards.

Dashboard interactions:

- `View all markets` → `/markets`.
- Clicking any market → `/markets/:id`.
- Clicking any hash opens the transaction proof drawer.
- Clicking an agent opens an inline detail panel with policy, last decision, inventory, and journal evidence.
- Clicking a risk control opens its definition, current value, limit, provenance, and rejection history.
- `Generate AI summary` stays user-triggered and visibly labeled `LLM COMMENTARY`.
- Settings opens from a top-bar gear/menu action as a compact popover or right drawer.

---

## Page 3 — Markets directory

Purpose: make every live and recently finalized market findable.

Header controls:

- Search by asset, market ID, venue ID, or interval.
- Filters: `Live`, `Birth`, `Genesis`, `Reprice`, `Endgame`, `Finalized`, `Void`, `No book`.
- Asset and interval filters.
- Sort by newest birth, nearest expiry, lifecycle, touch, and activity.
- `Refresh` plus actual last-updated timestamp.

Each market row/card contains:

- Asset and interval.
- Lifecycle badge and seconds-to-expiry.
- Up/down touch and visible book status.
- Opening/strike and spot with provenance.
- Model estimate/fair-value band with provenance.
- Trade count/fill summary only when real.
- Market ID and copy action.
- `Inspect` link to `/markets/:id`.

Use a high-density table on desktop and stacked cards on mobile. A market born with no liquidity must say `NO BOOK` or `EMPTY BOOK — awaiting genesis`; this is a meaningful product state, not a visual failure.

---

## Page 4 — Market detail `/markets/:id`

Purpose: give one market a complete, verifiable narrative.

Top:

- Breadcrumb: `Markets / BTC 5m`.
- Market identity, lifecycle, market ID, copy link, explorer link.
- Large seconds-to-expiry clock with explicit timezone/UTC treatment.
- Status, opening/strike, spot, venue, and settlement state.

Main layout:

- Left/primary: order-book ladder with asks, touch, bids, sizes, timestamp, and source.
- Right/primary: fair-value estimate, band, sigma, samples, calculation note, and source timestamp.
- Under it: visual lifecycle timeline with the current stage highlighted and completed stages clickable to relevant history evidence.
- Agent activity: GENESIS quote/requote and VECTOR decision/IOC events for this market.
- Risk explanation: controls that allowed, blocked, or constrained an action.
- Settlement/proof panel: final outcome, oracle link, claim status, receipts, and transaction drawer access.
- Optional chart only if backed by real historical values; label missing intervals honestly.

Do not use a generic candlestick chart as decoration. The order book, opening anchor, fair-value band, and lifecycle are the central visual story.

---

## Page 5 — History / audit trail

Purpose: turn every action into inspectable evidence.

Tabs or segmented controls:

- `All events`
- `Orders`
- `Fills`
- `Settlements`
- `Risk decisions`
- `Journal only`

Filters:

- Time window.
- Market/asset/interval.
- Agent (`GENESIS`, `VECTOR`, human wallet).
- Event type.
- Provenance/source.
- Confirmed, pending, failed, or rejected.

Each row shows timestamp, actor, event, market, decision/result, provenance, and hash/status. Selecting a row opens an audit drawer with:

- Full event payload with secrets redacted.
- Inputs and outputs.
- Policy/risk reason.
- Chain block/receipt when available.
- Explorer link.
- Related preceding and following events.

Clearly distinguish `JOURNAL EVENT` from `CHAIN FACT`. A journal record is not independently chain-verified merely because it appears in history.

---

## Page 6 — Docs

Use the existing docs content, but give it a proper documentation layout:

- Left table of contents on desktop; top select/drawer on mobile.
- Search.
- Product overview.
- Lifecycle/mechanism.
- Architecture.
- Somnia and DreamDEX integration.
- Agents and policies.
- RiskEngine and safety boundaries.
- Fair-value methodology.
- LLM limitations.
- SDK, CLI, MCP, and API reference.
- On-chain verification guide.
- Security, deployment, and troubleshooting.
- Evidence/reports with dates and scope.

Include contextual links back to the exact dashboard, market, event, or explorer proof wherever a technical claim appears.

---

## Page 7 — Pricing

Pricing is a real page reachable from the top menu, but it must never pretend billing is implemented.

Use a `Standard` / `LLM-Enhanced` comparison that makes clear the market engine, risk, execution, and data are identical. The LLM option changes narration/briefing availability only.

Cards:

- **Free Explorer — AVAILABLE NOW:** public observatory, market state, risk/activity views, settlements, docs, SDK/CLI/MCP access.
- **Pro Operator — PLANNED:** firm orchestration, configurable policies, alerts, advanced monitoring, API access.
- **Enterprise/Venue — PLANNED:** dedicated deployment, custom controls, private monitoring, integrations.

Use `Planned`, `Join waitlist`, or `Contact`; never add fake checkout, fake subscribers, fake logos, fake savings, or fake conversion counters.

---

## Contextual surfaces and menus

### Wallet surface

The wallet button is always in the top bar. Opening it shows connection/provider choice, address, chain validation, balance/activity, and disconnect. Human trading is a separate expandable surface on Dashboard and Market Detail.

Human order flow must be:

```text
Choose market → choose side/size/limit → Review IOC → show exact summary → RiskEngine check → Confirm in wallet → pending receipt → verified result
```

Never sign or send from a single ambiguous button. If rejected, show the exact reason and preserve the user’s entered values safely.

### Transaction proof drawer

Universal pattern for hashes. Show pending, verified, failed, not found, block, timestamp, status, actor, market, and safe explorer link. Never truncate the only copy of the hash; include a copy button and accessible full-value label.

### Settings popover

Include live/simulation display, refresh preference, asset/interval defaults, density, reduced motion, and wallet/network status. Do not expose secrets. Persist harmless display preferences only.

### Command menu

Top-level commands: navigate to every page, search markets, open selected market, focus filters, open wallet, open settings, view keyboard shortcuts, and open docs. Commands must be disabled or marked unavailable when data is not present.

---

## Provenance and state language

Place one badge immediately beside every applicable datum, not only in a legend:

| Badge | Meaning |
|---|---|
| `CHAIN FACT` | Read from Somnia RPC, contract, chain event, or verified indexer. |
| `MODEL ESTIMATE` | Computed by TEMPO fair-value logic from live inputs. |
| `POLICY` | Set by operator configuration/risk policy. |
| `DERIVED` | Calculated from sourced values. |
| `JOURNAL EVENT` | Recorded by the journal; not independently chain-verified. |
| `LLM COMMENTARY` | Generated narration from journal facts; never controls the system. |

Canonical states:

`Loading…` · `NO DATA` · `UNAVAILABLE` · `PENDING` · `PENDING RECEIPT` · `NOT FOUND` · `NO ACTIVE WINDOW` · `NO BOOK` · `EMPTY BOOK — awaiting genesis` · `LLM narration not configured — deterministic mode`.

Every loading state gets a skeleton that preserves final layout. Every error gets a plain-language cause, retry action where safe, and source/status. No page may become unusable because one API, SSE stream, oracle link, or wallet provider fails.

---

## Interaction, accessibility, and responsive quality

- Use semantic landmarks: header, nav, main, complementary, footer.
- Every control has a visible focus state, accessible name, and keyboard operation.
- Keyboard shortcuts: `1–7` pages, `/` search, `j/k` move through tables/tape, `Enter` inspect, `Esc` close, `?` shortcuts.
- Announce live updates politely; do not steal focus when SSE data arrives.
- Respect `prefers-reduced-motion`; birth pulses and transitions must not be required to understand state.
- Do not encode meaning by color alone; pair semantics with text, icon, label, or shape.
- Maintain readable contrast and minimum touch targets.
- At 1440×900, the command center should show venue pulse, agent/risk pulse, selected market, and the beginning of evidence without awkward scrolling.
- At 390×844, the page must remain usable: top menu, mode/network/wallet status, selected-market access, and activity remain reachable.
- Tables become cards or horizontally scrollable regions with preserved labels; no clipped critical data.
- Use sticky page headers only where they do not obscure content or keyboard focus.

---

## Visual direction, excluding color choice

Aim for “institutional trading terminal meets transparent on-chain observatory.”

- Strong hierarchy, calm surfaces, restrained motion, precise spacing, and high information density.
- Use the existing TEMPO mark and flow media as brand anchors.
- Use typography contrast: readable UI text plus monospaced prices, timestamps, hashes, and IDs.
- Use semantic badges, dividers, small status indicators, and evidence links instead of oversized decorative cards.
- Avoid neon overload, gradients, excessive glassmorphism, chatbot-first layouts, giant empty hero sections, and speculative analytics.
- Make the live data itself the visual material.

Define design tokens for surfaces, text, borders, type scale, spacing, radii, density, motion, focus, and provenance roles. The final palette is intentionally left for the user to choose.

---

## Data and implementation contract

- Use existing server endpoints and typed state shapes wherever possible.
- Use polling and SSE together as currently supported; show the actual connection mode.
- Keep API payloads small and avoid refetching unchanged detail data.
- Escape all untrusted data before rendering.
- Allow safe HTTPS explorer/oracle URLs only.
- Keep route state in the URL so reload/deep-link behavior works.
- Preserve current tests and add UI tests for routing, state rendering, wallet review, transaction drawer, provenance, responsive navigation, and failure states.
- Do not change trading logic as part of a UI redesign.
- If a feature is not yet backed by an endpoint, mark it `PLANNED` or `UNAVAILABLE` rather than presenting a fake control.

Suggested component inventory:

`AppShell`, `TopNav`, `CommandMenu`, `NetworkPill`, `ModePill`, `WalletMenu`, `PageHeader`, `LifecycleBar`, `MarketTable`, `MarketCard`, `BookLadder`, `FairValuePanel`, `AgentCard`, `RiskPanel`, `ActivityTape`, `HistoryTable`, `SettlementPanel`, `ProvenanceBadge`, `StateBlock`, `TransactionDrawer`, `WalletTradePanel`, `BriefingCard`, `DocsLayout`, `PricingCard`, `SettingsPopover`.

---

## Judge-winning demo path

The first-time flow should be effortless:

```text
Landing → Open Observatory → Dashboard → click newborn market
→ see empty book → GENESIS quote/lifecycle change
→ inspect fair value and provenance → watch activity event
→ open transaction proof → inspect settlement/history → read docs proof
```

The UI should make this story visible without narration. A judge must be able to verify the transition from empty market to autonomous liquidity and then follow the evidence to the chain.

## Definition of done

- Every route above works on direct load, refresh, back/forward navigation, keyboard, touch, and narrow screens.
- The top navigation/menu is present and usable on every route.
- Every existing feature listed in this prompt remains available.
- No fake or unscoped values appear in any state.
- Loading, empty, pending, offline, rejected, failed, and not-found states are designed and tested.
- Market detail and history make the proof chain obvious.
- Wallet actions are explicit, reviewable, and RiskEngine-gated.
- LLM output is visibly subordinate to facts and carries its disclaimer.
- Docs, explorer links, and current evidence remain one click away.
- The finished product looks intentional at first glance and becomes more credible the deeper a judge inspects it.

## Final build instruction

Implement this plan as the authoritative TEMPO UI direction. Preserve the current product’s real behavior and security boundaries, separate the page experiences, keep the menu permanently at the top, and use evidence—not decoration—to create the strongest possible hackathon submission.
