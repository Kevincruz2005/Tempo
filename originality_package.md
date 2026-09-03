# ORIGINALITY PACKAGE — Non-Code Assets to Move Innovation & Originality 8.5 → 9+

> **What this is:** every asset needed to reframe, evidence, and communicate
> TEMPO's originality — without changing a single line of code. Markdown-only.
> Codex/user may integrate pieces into README, DESIGN.md, the demo script,
> and the submission description.
>
> **Honest ceiling math:** packaging alone ≈ 9.0. Packaging + external flow
> (Part 4) ≈ 9.3–9.5. The guaranteed 9.5 lever (Data Streams anchor feed)
> needs code and stays optional.

---

## Part 1 — The reframe (use this everywhere)

Judges pattern-match in the first 30 seconds. Control the pattern.

**NEVER say:**
- "an AI market-making bot on DreamDEX"
- "a trading agent for Event Contracts"
- "we made a smarter ec-maker"

**ALWAYS say (pick per context):**

One-liner:
> "DreamDEX creates a new prediction market every minute — and every one is
> born dead: no bids, no asks, no price. TEMPO is the missing piece of market
> structure: an autonomous opening auction that makes every window liquid the
> moment it exists."

Elevator (15s):
> "Exchanges run opening auctions so a new listing doesn't open in silence.
> DreamDEX's windows open in silence — every minute, forever, because no human
> can staff a market that dies in 15 minutes. TEMPO is a firm of autonomous
> agents that attends every birth: it prices the window from the oracle's live
> spot against the on-chain opening price, quotes both sides with zero
> inventory, manages the endgame, claims settlement, and rolls to the next
> window. The venue's missing market-structure function, run by machines,
> possible only on Somnia's 100-millisecond blocks."

Why it's not a bot (the key deflection):
> "A market-making bot profits from an existing market. TEMPO *creates* the
> market — there is no book to make until it anchors one. Liquidity genesis
> for ephemeral markets is a function the venue lacks, not a strategy on top
> of it."

## Part 2 — Name the primitive

Named primitives read as inventions. Use these terms consistently in README,
DESIGN.md, demo, and submission text:

- **Liquidity Genesis** — supplying the first two-sided quote to a
  newly-born ephemeral market (vs "market making", which presumes a book).
- **The Anchoring** — computing fair value from the oracle feed vs the
  on-chain opening price *before any book exists* (vs mid-of-book, which is
  circular at birth — the kit's own ec-maker falls back to 0.5).
- **Verifiable Machine Intelligence** — the information mechanism: every
  estimate journaled *before* action, scored *after* settlement against
  on-chain ground truth (Brier 0.072, directional 100% on scored markets),
> feeding bounded calibration epochs. "Show me another trading system whose
> intelligence you can audit against ground truth."
- **The Roll** — settle → claim → successor, the loop that turns a series of
  ephemeral windows into one continuous market.

## Part 3 — The differentiation table (put this in README, verbatim)

| | Bot-kit `ec-maker` (the baseline judges know) | TEMPO |
|---|---|---|
| Trigger | 10-second polling loop | Event-driven: chain-log live tail, same-block-era re-quote |
| Fair value | Mid of the *existing* book; 0.5 when empty | Computed from the official oracle feed vs the **on-chain opening price** — before a book exists |
| Role | Quotes a market that already has prices | **Creates the market at birth** (liquidity genesis) |
| Inventory | Mints sets to sell | Zero-inventory two-sided quote via mint-a-pair resting buys |
| Endgame | None | Time-decaying spread tightening + certainty skew policy |
| Settlement | Claim sweep | Observe on-chain resolution → void-aware redeem → automatic roll |
| Learning | None | Brier-scored calibration epochs, clamped, journaled |
| Evidence | Console logs | Typed journal + `tempo verify` cross-checks every tx hash on-chain |
| Interface | — | CLI + published SDK + MCP server + single-screen observatory |

One-sentence caption for the table:
> "ec-maker is a quoting loop. TEMPO is a lifecycle — and its intelligence is
> measured, not claimed."

## Part 4 — External flow playbook (no code, biggest lever)

Originality proven by other people's behavior beats any pitch. Goal: at least
3–5 fills from wallets that are NOT GENESIS/VECTOR, visible in the activity
tape before the demo is recorded.

Timeline (deadline 2026-09-08):
- **T-4 to T-3 days:** post the invite (drafts below) in the hackathon
  Telegram (t.me/+XHq0F0JXMyhmMzM0) and the Somnia/DreamDEX community
  channels. Keep the firm running the whole window.
- **T-3 to T-1:** the tape accumulates external fills. Screenshot the
  dashboard tape showing maker=GENESIS, taker=<external address>.
- **T-1:** record the demo (see Part 5), including the external-flow moment.

Telegram draft 1 (dev channel, honest + specific):
> We noticed every DreamDEX event-contract window opens with an empty book
> (we verified: finalized 1m windows with literally 0 trades). Our hackathon
> build, TEMPO, is an autonomous opening auction that anchors every newborn
> BTC/ETH window on Shannon testnet with two-sided quotes derived from the
> oracle feed vs the on-chain opening price. It's live right now — if you
> want to see it work, open any 5m BTC window on the testnet event-contracts
> page and trade against our quotes. Fair-value model currently scores
> Brier 0.072 against settlements. Happy to share the numbers.

Telegram draft 2 (shorter, casual):
> our agent firm is live-quoting every new event contract window on shannon
> testnet — every BTC/ETH window now opens with a two-sided book. come take
> the other side and watch it reprice you 🙂

Proof mechanics (already in the product — zero code needed): the dashboard
activity tape attributes every fill to wallet addresses; the journal records
maker/taker per fill; `tempo verify` checks every hash on-chain. External
fills are therefore self-evidencing.

## Part 5 — Demo beats that carry originality (weave into the 2.5-min script)

- **0:00–0:20 The dead birth.** Show a finalized window with 0 trades (from
  `tempo settlements` or the dashboard). "This market existed for 15 minutes
  and never had a price."
- **0:20–0:40 The anchor.** Show a live birth: book empty → GENESIS quotes
  appear; show the fair-value panel with inputs (spot, strike, σ, time) —
  say "Anchoring: priced from the oracle feed against the on-chain opening
  price, before a book exists."
- **0:40–1:10 The disagreement.** VECTOR takes against GENESIS when their
  estimates diverge. "Two independent agents, two policies, one real trade."
- **1:10–1:40 Verifiable intelligence.** Show the Brier section of
  `tempo report`. "Every estimate is journaled before it acts and scored
  against on-chain truth after settlement. 0.072. The firm grades itself,
  then recalibrates within bounds."
- **1:40–2:10 The roll + proof.** Window locks → settles (oracle explorer
  link) → claim tx hash → successor window opens → quotes appear. Run
  `tempo verify`: hashes checked on-chain, 0 failures.
- **2:10–2:30 External flow + close.** If Part 4 landed: show external
  wallets' fills on the tape — "other traders rely on the book we create."
  Close on the one-liner.

## Part 6 — Judge Q&A ammunition

**Q: "How is this different from a market maker?"**
A: "A market maker profits from an existing market. TEMPO creates the market
— until it anchors, there's nothing to make. That's a market-structure
function, the same reason exchanges run opening auctions."

**Q: "Where's the AI? There's no LLM."**
A: "There's measured intelligence instead. The appraiser computes
probabilities continuously across ~14 concurrent windows at machine cadence —
infeasible manually — and the system scores every estimate against on-chain
settlement truth, Brier 0.072, then self-calibrates within clamped bounds. We
deliberately kept an LLM out of the hot path: at 100ms blocks there's no room
for one, and an LLM pricing 'BTC above its open in 8 minutes' adds latency,
not accuracy."

**Q: "Couldn't the bot kit do this?"**
A: "The kit's maker polls every 10 seconds and quotes the mid of an existing
book — at window birth that's a 0.5 fallback. TEMPO's whole contribution is
the birth: anchoring before a book exists, event-driven re-quoting, endgame,
settlement, claims, roll — plus evidence: 31 verified transaction hashes and
a graded calibration loop."

**Q: "Why Somnia and not any EVM chain?"**
A: "Gas at dust and ~100ms finality make continuous re-quoting across dozens
of windows economical; the venue settles via Somnia's on-chain reactivity
with no keeper; and our writes confirm in one round trip via
realtime_sendRawTransaction. On Ethereum the gas alone would exceed the edge
per quote."

**Q: "Is anyone using it?"**
A: (if Part 4 landed) "Yes — here are external wallets taking our quotes on
the tape." / (if not) "It's been live and quoting every window since
September 2nd; here's the full tape and the verified hash count."

## Part 7 — Where to integrate (for Codex, md-only)

1. README: add "The primitive" section (Parts 1–2), the differentiation
   table (Part 3), and the external-flow evidence once it exists.
2. DESIGN.md: rename §2 language to Liquidity Genesis / Anchoring terms.
3. Submission description on DoraHacks: use the one-liner + elevator.
4. Demo recording script: Part 5 beats.
5. After external fills appear: append a "Proven by others" subsection with
   tape screenshots + dates (real only).
