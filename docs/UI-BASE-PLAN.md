# TEMPO UI/UX — Final Hackathon Product Plan

## Goal

Build the TEMPO web experience to maximize judge comprehension, technical credibility, product quality, and ecosystem impact for the Somnia × DreamDEX Event Contracts Hackathon.

The UI must feel like a serious autonomous trading observatory—not a generic DeFi dashboard.

The product must make four things immediately clear:

1. What markets exist?
2. What is TEMPO doing?
3. Why did it do it?
4. Can the action or result be verified?

The winning product principle is:

> **Show the market first. Show what TEMPO is doing second. Show the proof underneath it.**

No fabricated users, volume, TVL, revenue, transactions, partnerships, performance, or AI capabilities.

---

# 1. Product Architecture

Keep the application minimal.

## Five primary pages

1. **Landing**
2. **Dashboard**
3. **Markets**
4. **History**
5. **Docs**

Do not create separate top-level pages for:

- Agent
- Risk
- Analytics
- Market Detail
- Settings

Those belong inside the existing pages as panels, drawers, modals, or inline expansions.

## Pricing

Pricing should be a section or modal rather than a required sixth primary page.

## Settings

Settings should be a compact popover or side panel from the Dashboard.

---

# 2. Core UX Philosophy

The application should feel like:

**professional trading terminal + Web3 observatory + autonomous-firm control room**

It should not feel like:

**generic crypto dashboard + AI chatbot**

The visual hierarchy should be:

**Market state → Agent action → Risk state → Evidence → Commentary**

Never give LLM commentary stronger visual authority than chain facts, market state, or risk state.

---

# 3. Global Navigation

## Desktop

Header:

**TEMPO | Dashboard | Markets | History | Docs**

Right side:

**Somnia 50312 ● | Connect Wallet**

The active page must have an obvious selected state.

## Mobile

Header:

**TEMPO | Menu | Wallet**

Menu contains:

- Dashboard
- Markets
- History
- Docs
- Pricing

Wallet and network state remain accessible.

---

# 4. Canonical Product Language

Use these terms consistently throughout the application:

- **Autonomous trading agent**
- **Real-time fair-value engine**
- **MODEL ESTIMATE**
- **CHAIN FACT**
- **POLICY**
- **DERIVED**
- **LLM COMMENTARY**
- **RiskEngine**
- **Optional report narration**
- **On-chain verification**
- **Zero-mock**

Do not describe TEMPO's pricing engine as:

- AI pricing model
- AI fair-value model
- Quantitative fair-value engine
- AI estimate
- Deterministic AI trader

GENESIS and VECTOR are autonomous trading agents, not AI agents.

Gemini/LLM is optional narration only and never controls:

- Pricing
- Risk
- Execution
- Order placement
- RiskEngine overrides

---

# 5. Trust and Provenance System

Provenance is a core TEMPO UX feature.

Every meaningful data point should be classified where relevant.

## CHAIN FACT

Value verified from Somnia or the verified indexer.

## MODEL ESTIMATE

Value estimated by TEMPO's real-time fair-value engine.

## POLICY

Value derived from local configuration or risk policy.

## DERIVED

Value calculated from sourced inputs.

## LLM COMMENTARY

Narrative generated from journal facts.

Example:

**Fair Value**
`61.4%`
`MODEL ESTIMATE`

**Opening Price**
`$X`
`CHAIN FACT`

**Inventory Limit**
`500`
`POLICY`

**Briefing**
`LLM COMMENTARY`

The provenance badge should be visually consistent across all pages.

---

# 6. Landing Page

The Landing page must be short and immediately understandable.

## Hero

Headline:

> **Every Event Contract is born with an empty book.**

Supporting text:

> **TEMPO is the autonomous opening-auction and market-making layer for DreamDEX Event Contracts on Somnia.**

Primary action:

**Open Observatory**

Secondary action:

**Connect Wallet**

Network:

**Somnia Shannon · Chain 50312**

## Lifecycle Visualization

Immediately below the hero:

**BIRTH → ANCHOR → FAIR VALUE → AGENT ACTION → REPRICE → ENDGAME → SETTLE → CLAIM → ROLL**

Use the existing TEMPO visual identity and flow animation where appropriate.

The lifecycle is the core conceptual visual.

## Proof Strip

Show a small number of verified metrics:

- **369** — windows observed
- **6,274** — decisions journaled
- **120** — unique transaction hashes
- **2,107** — automated tests

Then:

**31/31 funded validation transactions verified**

Then:

**0 mocked economic values**

Do not overload the landing page with every available metric.

## Why TEMPO

Three compact cards:

### Market Birth

Event Contracts begin with empty books.

### Autonomous Liquidity

GENESIS establishes two-sided liquidity and manages quotes.

### Verifiable Execution

VECTOR trades independently while RiskEngine controls execution boundaries and the chain provides verifiable evidence.

---

# 7. Dashboard

The Dashboard is the most important page.

A judge should understand the system within roughly 10–15 seconds.

## Header

**TEMPO Dashboard**

Status:

**Somnia Shannon · Live**

Show a clear last-update indicator when real data is available.

## Status Row

Use four compact status cards:

### Live Markets

Actual active market count.

### GENESIS

`QUOTING` / current verified state.

### VECTOR

`WATCHING` / current verified state.

### Risk

`WITHIN LIMITS` / actual state.

Never invent values.

---

# 8. Dashboard Market Lifecycle

The main Dashboard card should visually represent the current market lifecycle.

Example:

## BTC · 1M

**REPRICE**

Lifecycle:

**BIRTH ✓ → ANCHOR ✓ → FAIR VALUE ✓ → ACTION ✓ → REPRICE ● → SETTLE**

Then show:

| Value | State |
|---|---|
| Spot | Actual value + `CHAIN FACT` |
| Strike | Actual value + `CHAIN FACT` |
| Fair value | Actual value + `MODEL ESTIMATE` |
| Time remaining | Actual value |
| Market status | Actual state |

Current action:

**GENESIS → REQUOTE**

The judge should be able to understand the current system state without opening another page.

---

# 9. Agent Cards

Keep agents visible but compact.

## GENESIS

**AUTONOMOUS TRADING AGENT**

Role:

**Liquidity-genesis maker**

Show:

- Status
- Position
- Inventory utilization where available
- Last action
- Last decision time

Example:

`Last action: REQUOTE`

## VECTOR

**AUTONOMOUS TRADING AGENT**

Role:

**Adversarial taker**

Show:

- Status
- Position
- Current edge state where available
- Last action
- Last fill

Example:

`Last action: IOC FILL`

Do not use oversized AI imagery or generic AI-chat styling.

---

# 10. Risk Panel

RiskEngine should be a first-class visual component.

## Risk Engine

Status:

**SAFE**

Show:

| Control | State |
|---|---|
| Inventory | Actual state |
| Collateral | Actual state |
| Capital | Actual state |
| Tick / lot | Actual state |
| Expiry headroom | Actual state |
| Mandatory expiry | Actual state |

When real evidence exists:

**1 rejected order**

`Inventory cap`

Do not fake risk values.

---

# 11. Activity Tape

Create a live operational tape below the main Dashboard area.

Each row should contain:

**Timestamp · Actor · Action · Provenance · Transaction**

Example:

**22:41:18**

**VECTOR**

`IOC FILL`

`CHAIN FACT`

`0x3d2cc4…`

Another:

**GENESIS**

`REQUOTE`

`MODEL ESTIMATE`

Another:

**CHAIN**

`MARKET FINALIZED`

`CHAIN FACT`

The tape should make the system feel alive while remaining evidence-based.

---

# 12. LLM Briefing

Place the briefing below core trading/risk information.

## Operator Briefing

Badge:

`LLM COMMENTARY`

Display:

- Generation time
- Source journal window
- Generated narrative

Always include:

> Advisory commentary generated from journal facts. The LLM does not control pricing, risk, or execution.

LLM output must never visually imply trading authority.

---

# 13. Markets Page

Markets should feel like a simplified professional venue.

## Header

**Live Markets**

Filters:

- BTC
- ETH
- Interval
- All / selected status where supported

## Market Table

| Market | Spot | Fair Value | Bid | Ask | Expiry | Agent |
|---|---:|---:|---:|---:|---:|---|
| BTC Up | Actual | Actual | Actual | Actual | Actual | GENESIS |
| ETH Down | Actual | Actual | Actual | Actual | Actual | GENESIS |

Only show real data.

If unavailable:

- `UNAVAILABLE`
- `NO DATA`
- `PENDING`

Never insert fake zeros, 50% probabilities, dummy balances, or dummy transactions.

---

# 14. Inline Market Expansion

Do not create a separate Market Detail page.

Selecting a market expands an inline detail panel.

Include:

## Market State

- Spot
- Strike
- Fair value
- Expiry
- Settlement status

## Order Book

Actual order-book levels.

## Lifecycle

Current stage.

## Agents

GENESIS / VECTOR state.

## Evidence

- Explorer link
- Oracle link
- Relevant transaction/journal references

This keeps navigation minimal while allowing deep inspection.

---

# 15. History Page

History is the audit surface.

## Filters

- All
- Orders
- Fills
- Settlements
- BTC / ETH
- Time range

## Activity Table

| Time | Type | Agent | Provenance | Result | Transaction |
|---|---|---|---|---|---|
| Actual | Fill | VECTOR | CHAIN FACT | Confirmed | Actual hash |
| Actual | Requote | GENESIS | MODEL ESTIMATE | Posted | — |
| Actual | Settlement | CHAIN | CHAIN FACT | Finalized | Actual hash |

Explicitly distinguish:

**JOURNAL EVENT**

from:

**CHAIN FACT**

Do not merge them into an ambiguous event stream.

---

# 16. Transaction Drawer

Clicking a transaction opens a compact drawer.

Show:

**Transaction**

Full actual hash

**Agent**

Actual actor

**Action**

Actual action

**Status**

Actual confirmation status

**Network**

Somnia 50312

**Explorer**

Open transaction

**Journal event**

Open related journal information

The proof should be one click away.

---

# 17. Pricing

Pricing is a section/modal rather than a mandatory sixth page.

Top:

# TEMPO Pricing

**Real-time fair-value engine**

**LLM commentary is optional.**

Toggle:

`Standard | LLM-Enhanced`

## Standard

**Verified operational intelligence**

- Live market state
- Fair-value estimates
- Risk information
- Activity
- Settlement information

## LLM-Enhanced

**Verified data + advisory narration**

- Everything in Standard
- Journal briefing
- Market commentary
- Report summaries

Explicit boundary:

> **LLM output does not control pricing, risk, or execution.**

---

# 18. Commercial Tiers

Keep commercial positioning understated.

## Free Explorer

**AVAILABLE**

- Live Somnia testnet dashboard
- Market data
- Settlement data
- Read-only risk/activity
- Documentation
- SDK access
- Limited LLM briefings

**Free**

## Pro Operator

**PLANNED**

- Maker/taker orchestration
- Configurable risk limits
- Wallet-connected human trading
- Advanced monitoring
- Advanced LLM insights
- SDK/API access

**Planned**

## Enterprise

**PLANNED**

- Dedicated deployment
- Custom risk controls
- Private monitoring
- Mainnet support
- Priority support
- Custom integrations

**Contact us / Planned**

Do not build:

- Fake checkout
- Fake subscriptions
- Fake customer counts
- Fake billing status
- Fake provisioning

Only Free Explorer is currently available unless actual billing exists.

---

# 19. Docs Page

Keep documentation organized but lightweight.

## Getting Started

- Product overview
- Quick start

## Architecture

- Lifecycle
- Agents
- RiskEngine
- Somnia integration

## Developer

- `@tempo/core`
- CLI
- MCP
- API

## Verification

- Provenance
- Zero-mock discipline
- On-chain verification

## LLM

- Gemini narration
- Limitations
- Trust boundaries

Link to existing repository documentation rather than duplicating entire documents unnecessarily.

---

# 20. Settings

Settings must not become another page.

Gear icon opens a compact popover or side panel.

## Display

- Density
- Display preferences

## Defaults

- Asset
- Interval
- Refresh preferences

## Connection

- Wallet
- Network

Must work with:

- Mouse
- Keyboard
- Touch

Never depend on hover alone.

Never expose or store:

- Private keys
- Seed phrases
- Signing credentials
- Secrets

---

# 21. Wallet UX

Public observation must not require wallet connection.

Without wallet:

**Explore public product and market state**

With wallet:

**Human-specific actions become available**

Human trade flow:

**Prepare Order**

→ **Show Transaction Summary**

→ **User Confirms**

→ **Wallet Signs**

→ **Existing RiskEngine Path**

→ **Chain Confirmation**

The UI must make clear that connecting a wallet does not activate autonomous trading.

---

# 22. Data States

Every major component should have honest states.

## Loading

`Loading...`

## Missing

`UNAVAILABLE`

## Empty

`NO DATA`

## Awaiting chain/indexer

`PENDING`

Do not use placeholder values merely to populate empty UI.

---

# 23. Responsive Design

## Desktop

Two-column or three-column operational layout depending on width.

## Tablet

Two-column layout.

## Mobile

Stack in this order:

1. Market state
2. Agent state
3. Risk state
4. Activity
5. Briefing

Navigation becomes compact.

Wallet and network status remain accessible.

---

# 24. Visual Language

The product should communicate:

**TIME + MARKET + PROOF**

Use:

- Lifecycle lines
- Event pulses
- Compact status indicators
- Provenance badges
- Market-state labels
- Transaction links
- Clear typography
- High information density without clutter

Avoid:

- Excessive gradients
- Giant AI robot imagery
- Unnecessary 3D cards
- Generic Web3 neon overload
- Huge decorative charts
- Meme styling

TEMPO should look like serious trading infrastructure.

---

# 25. Animation

Animation should communicate state.

Good:

- Lifecycle progression
- New event arrival
- Quote updates
- Activity tape insertion
- Settlement transitions

Avoid:

- Continuously moving backgrounds
- Excessive particle effects
- Animated numbers everywhere

The UI must remain understandable with animation disabled.

---

# 26. Lifecycle as the Visual Identity

Use the same lifecycle vocabulary across the product:

**BIRTH → ANCHOR → FAIR VALUE → AGENT ACTION → REPRICE → ENDGAME → SETTLE → CLAIM → ROLL**

## Landing

Full lifecycle.

## Dashboard

Current lifecycle.

## Markets

Market lifecycle.

## History

Completed lifecycle events.

## Docs

Lifecycle explanation.

This makes the entire product feel like one coherent system.

---

# 27. Proof View

Add a small toggle on Dashboard:

**Live View | Proof View**

Do not create a new page.

## Live View

Optimized for operation.

## Proof View

Emphasize:

- Journal events
- Transaction hashes
- Provenance
- Chain confirmations
- Lifecycle state

This is especially useful during a hackathon demo.

---

# 28. Dashboard Without a Wallet

The Dashboard must be publicly viewable.

Wallet connection should only be required for wallet-specific actions.

A judge should never have to:

- Connect MetaMask
- Switch network
- Sign a message
- Fund a wallet

just to understand what TEMPO does.

---

# 29. Demo Experience

The entire application should support a clean 2–3 minute judge walkthrough.

## 0–10 seconds

Landing:

> **Every Event Contract is born with an empty book.**

Click:

**Open Observatory**

## 10–25 seconds

Dashboard:

Show:

- Live markets
- GENESIS
- VECTOR
- Risk status
- Current lifecycle

## 25–45 seconds

Open a live market.

Show:

**Anchor → Fair Value → Agent Action**

## 45–70 seconds

Open Activity.

Show:

**VECTOR IOC FILL**

Click:

`0x3d2cc4…`

Open explorer.

## 70–100 seconds

Show:

**RiskEngine**

Then the actual:

**inventory-cap rejection**

## 100–130 seconds

Show History.

Demonstrate:

**Journal event vs Chain fact**

## 130–150 seconds

Show Operator Briefing.

Explain:

**LLM commentary only.**

## 150–180 seconds

Show Docs / Architecture.

Finish:

> **TEMPO turns the empty birth of an Event Contract into an autonomous, observable, risk-bounded market lifecycle.**

---

# 30. Implementation Priorities

## P0 — Must Have

1. Navigation
2. Landing
3. Dashboard
4. Live Markets
5. Activity tape
6. Agent status
7. Risk panel
8. Provenance badges
9. Wallet connection
10. Responsive layout

## P1 — Important

11. History
12. Transaction drawer
13. Pricing section/modal
14. LLM briefing
15. Settings
16. Docs index

## P2 — Polish

17. Lifecycle animation
18. Proof View
19. Transition refinement
20. Mobile refinement
21. Accessibility refinement

Do not start with P2.

---

# 31. Hard Constraints

The implementation must preserve:

- Real data only
- No fabricated metrics
- No fake subscriptions
- No fake users
- No fake transactions
- No private keys in browser
- No LLM pricing authority
- No LLM execution authority
- No RiskEngine bypass
- No unnecessary top-level pages
- No change to trading behavior merely for visual effect

The browser must remain a surface over the existing TEMPO system.

---

# 32. Existing Evidence to Surface

Preserve and display only verified current evidence:

- **369** windows observed
- **6,274** decisions journaled
- **168** real orders sent
- **120** unique transaction hashes across the full 24-hour operation
- **10** on-chain fills
- **3** settlements claimed
- **996** operational errors journaled
- **0** firm crashes
- **31/31** funded validation transaction hashes independently verified
- **Brier score 0.1093 across 6 scored markets**
- **83.3% directional accuracy**
- **2,107** automated tests
- **2,048-case** economic/decimal invariant matrix
- **0** mocked economic values

Historical **0.0723 / 100% / 3 markets** may appear only where explicitly marked historical.

---

# 33. Final Product Structure

The resulting application should be:

**TEMPO**

↓

**Landing**

↓

**Dashboard**

↙︎      ↓      ↘︎

**Markets · History · Docs**

With:

**Pricing = section/modal**

**Settings = popover/drawer**

**Market details = inline expansion**

**Transaction details = drawer**

**Proof View = Dashboard toggle**

No unnecessary navigation.

---

# 34. Winning UX Principle

The entire experience should make a judge think, in sequence:

> **“I understand what this system does.”**

Then:

> **“I can see it operating.”**

Then:

> **“I can see why it made that decision.”**

Then:

> **“I can verify the result myself.”**

That is the target experience.

The objective is not to make TEMPO look like the biggest product.

The objective is to make TEMPO feel like the **most complete, technically credible, and immediately understandable solution to the empty-market problem in DreamDEX Event Contracts.**
