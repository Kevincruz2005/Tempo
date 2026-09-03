# 05 — REQUIREMENTS MATRIX + PRE-SUBMISSION GATE

> Part A is filled now (before implementation, per the universal requirements).
> Part B must be re-run by the builder at the END of the build and the output
> saved to `test/reports/submission-gate.md`. An unchecked mandatory box blocks
> submission.

---

## PART A — Requirements matrix (universal requirements §3)

| Requirement | Source | Mandatory? | Implementation | Evidence (to produce) |
|---|---|---:|---|---|
| Ecosystem-native project on Somnia | Hackathon theme | Yes | Whole architecture exploits Somnia: reactivity, ~100 ms blocks, one-round-trip writes, negligible gas (DESIGN §6) | DESIGN §6 + live probe + demo |
| DreamDEX integration | Hackathon theme | Yes | Event-contract markets-sdk (all three tiers), live watches, price feed, settlement/claims flow (DESIGN §15) | `tempo verify` tx hashes |
| Event Contracts as core | Hackathon theme | Yes | The window lifecycle IS the product (DESIGN §8 removal test) | demo of birth→settle→claim |
| Autonomous agents | Hackathon theme | Yes | GENESIS maker + VECTOR taker, real policies over real inputs (DESIGN §9, §10) | journal decisions + disagreement logs |
| Official SDK utilization | Universal reqs §17–18 | Yes | markets-sdk unified/client/trader + watches + reactivity + price feed + ABIs; justified non-use for HTTP/spot WS (RECONNAISSANCE §3) | RECONNAISSANCE §3 table |
| Testnet deployment/actions | Universal reqs §29 | Yes | Real txs on Somnia Shannon 50312: faucet, mintSet, quotes, cancels, IOC fills, redeem | `test/reports/*` real hashes |
| CLI release | Universal reqs §24 | Yes | `tempo` CLI, every command over `@tempo/core` (DESIGN §16) | CLI tests + `--help` capture |
| Reusable SDK release | Universal reqs §25 | Yes | `@tempo/core` public surface (DESIGN §17) | SDK tests + docs |
| CLI + web parity | Universal reqs §26 | Yes | Both consume `@tempo/core`; web is served by engine | architecture in README |
| Zero mocked values | Universal reqs §14 | Yes | AGENTS.md rule 1; provenance journaling; honest UNAVAILABLE states | DESIGN §32 audit + `tempo verify` |
| Test suite + evidence | Universal reqs §27–30 | Yes | `/test` tree per DESIGN §24; real hashes only | `test/reports/` |
| Demo 60–120 s | Universal reqs §37 | Yes | DESIGN §27 second-by-second script | recorded demo + live run |
| Repository + README | Universal reqs §31–32 | Yes | README reproducibility path; `.env.example` | fresh-clone run |
| Official hackathon rules/judging weights | The original master prompt (authoritative) | Yes | Scoring weights fixed in `02-DESIGN.md` Part I §4 are the master prompt's weights (§42) — used as-is; re-score only if organizers publish different official weights | this row + DESIGN §4 |

---

## PART B — Pre-submission gate (universal requirements §45–46)

Run after Phases 1–6 of `04-BUILD-PLAN.md`. Save the filled checklist to
`test/reports/submission-gate.md`.

### PRODUCT
- [ ] Original primitive (liquidity genesis / opening-auction firm)
- [ ] Clear economic value (spread + maker yield + liquid windows for the venue)
- [ ] Useful product (CLI + SDK + dashboard all functional)
- [ ] Professional UI (single screen, no page scroll, premium financial aesthetic)
- [ ] Strong demo (DESIGN §27 script, recorded + live)
- [ ] Clear target user (market makers/agent operators on DreamDEX; the venue itself)
- [ ] Clear differentiation (vs bot-kit ec-maker: genesis anchoring, reactivity, full lifecycle)

### HACKATHON
- [ ] Every mandatory requirement in Part A satisfied with evidence
- [ ] Submission format satisfied (repo + demo per official rules)
- [ ] Required sponsor technologies integrated and visible in demo

### ECOSYSTEM
- [ ] Somnia thesis understood and exploited (reactivity, finality, cost)
- [ ] Not a generic EVM deployment (removal test in DESIGN §6–8 passes)
- [ ] All relevant official infrastructure evaluated (RECONNAISSANCE §3)

### CORE TECHNOLOGY
- [ ] Event Contracts load-bearing (no EC ⇒ no product)
- [ ] Real on-chain integration (writes gated on-chain, receipts checked)
- [ ] Real transactions recorded (hashes in `test/reports/`)

### AI / AGENTS
- [ ] AI genuinely necessary (fair value + risk at machine speed across ~14 windows; human-limitation test)
- [ ] Agent decisions observable (journal: inputs → decision → tx)
- [ ] Agent state real (on-chain balances, real fills; two keys, two capitals)
- [ ] No hardcoded fake autonomy (policies are pure functions of live inputs, unit-tested)
- [ ] **QUANTITATIVE ESTIMATE vs FACT separated**: every fair-value/probability shown is
      labeled an *estimate* with its inputs; on-chain status/prices/fills/settlements
      are labeled *facts* with provenance (rule added to AGENTS.md #13)

### DATA
- [ ] Mocked economic values = 0 (grep-audit the UI + journal for literals)
- [ ] Real API/on-chain data with provenance tags
- [ ] Honest UNAVAILABLE/PENDING/NO DATA states exercised on camera
- [ ] No fabricated blockchain evidence anywhere (test fixtures marked and isolated)

### DEVELOPER PRODUCT
- [ ] CLI released and documented (`tempo --help`)
- [ ] SDK released and documented (README §SDK with typed examples)
- [ ] CLI and web share `@tempo/core` (no duplicated logic)
- [ ] Another developer can reuse the primitive (SDK quickstart in README)

### TESTING
- [ ] Unit / SDK / Integration / Contract / E2E / Failure / Security / Economic / CLI suites present and green (offline ones via `npm test`)
- [ ] Testnet validation evidence recorded (real hashes)
- [ ] `/test` evidence organized per DESIGN §24

### REPRODUCIBILITY
- [ ] Fresh clone → `npm install` → `.env` → `npm run faucet` → `npm test` works
- [ ] All CLI commands documented
- [ ] Demo reproducible end-to-end without hidden manual state (DRY_RUN default; writes need explicit env)

### PRESENTATION
- [ ] Problem understood in <10 s ("every window is born empty")
- [ ] Solution understood in <20 s ("an agent firm runs the opening auction")
- [ ] Core innovation visible (birth → anchored quotes materialize, on camera)
- [ ] Real proof shown (tx hashes, on-chain balances, oracle-explorer link)
- [ ] Holy-shit moment included (DESIGN §28)
- [ ] Final pitch delivered (DESIGN §40)

### AUTOMATIC REJECTION CONDITIONS — all must be NO
- [ ] MOCK DATA > 0 in production/demo path? **must be NO**
- [ ] Removing Event Contracts changes little? **must be NO**
- [ ] Moving to another EVM chain changes little? **must be NO** (reactivity + one-round-trip writes + cost structure are Somnia-load-bearing)
- [ ] Replacing DreamDEX with a generic prediction API keeps the mechanism? **must be NO** (mint-a-pair, opening-price strikes, Finalized claims, expiry switches are DreamDEX-native)
- [ ] Humans could run every agent action manually at equal quality? **must be NO**
- [ ] Major official tooling ignored without justification? **must be NO** (RECONNAISSANCE §3)
- [ ] Fake autonomy / fake blockchain / fake analytics anywhere? **must be NO**
- [ ] Critical functionality without meaningful automated tests? **must be NO**
- [ ] Product exists only as a frontend? **must be NO** (CLI + SDK are the primary surfaces)

---

## PART C — Final output document (master prompt §45)

The submission must include `docs/FINAL.md`: the complete 40-section final
output (Project Name → 30-Second Pitch) **refreshed with real build evidence**
— actual tx hashes, real demo capture references, the final SDK utilization
matrix (§33), the zero-mock audit (§32) with the grep/literal audit result, and
the judge-score prediction (§39). The spec version of all 40 sections already
exists in `02-DESIGN.md` (Part II); `docs/FINAL.md` is that document updated
from "designed" to "delivered", with an evidence pointer per section.

Also produce in the README the per-feature provenance table (master prompt §38):
which official ecosystem capability powers each feature
(book/watch → markets-sdk live watches; events+same-block sims →
`@somnia-chain/reactivity`; spot signal → official price feed; writes →
`realtime_sendRawTransaction`; settlement truth → on-chain + oracle explorer;
CLI → `@tempo/core`).
