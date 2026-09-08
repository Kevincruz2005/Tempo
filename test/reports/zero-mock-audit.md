# Zero-Mock Audit

## Final production check — 2026-09-08

- Local, GitHub, and Azure were aligned at commit `184242f` before this audit.
- Azure reported `dryRun: false`, an active live event tail, BTC and ETH price
  watches, two configured signing agents, eight active markets, and eight market
  views derived from current inputs.
- The complete Azure journal for the current service run contained **zero**
  sources or fields matching mock, fake, dummy, fixture, simulation, or demo.
- All 223 current-run journal records carrying an explicit `dryRun` flag were
  `false`; none were `true`.
- The current market's fee schedule was independently read from the official
  indexer: maker, taker, builder, routing, and settlement rates were all zero.
- The Observatory no longer renders that fee result from a literal. It reads
  `getMarketFees(marketId)` and renders `NO DATA` if the evidence is unavailable.
- The former numeric mock counter is now an explicit `NO MOCK FALLBACKS ·
  ENFORCED` policy assertion. It is not presented as a chain-derived metric.
- Local deterministic suite: 2,120 tests passed. TypeScript, UI syntax, secret
  scan, and `npm audit --audit-level=high` passed; npm reported zero
  vulnerabilities.

Result: **PASS**. Production economic values are live facts, receipt/journal
facts, or deterministic calculations over those inputs. Missing evidence stays
`NO DATA` / `UNAVAILABLE`; no synthetic fallback is substituted.

- Run date: 2026-09-02
- Scope: production packages, current build documentation, README, and test
  code; captured upstream source documents were excluded.
- Result: PASS for production reads, funded writes, and dry-run paths.

## Literal Audit

The following production-risk patterns returned no matches:

```text
fallbackSigma
4e-5
catch(() => 0)
10 ** 6
1e6
1000000
```

Command scope:

```bash
rg -n '4e-5|fallbackSigma|catch\(\(\) => 0\)|10 \*\* 6|1e6|1000000' \
  packages docs/PROGRESS.md README.md test \
  --glob '!test/reports/*.md' --glob '!test/reports/*.png' \
  --glob '!test/reports/*.mp4'
```

## Evidence Audit

- Fair value returns `NO DATA` when real volatility/history is unavailable.
- Failed balance, fill, and settlement reads are surfaced as `UNAVAILABLE`;
  none are converted to zero.
- Quantization derives decimals and tick/lot sizes from live contract data.
- The dashboard's `MOCKED VALUES = 0` string is an audit label, not a value
  source. Birth/fill animation is journal-triggered.
- No fixture supplies production economic state.
- `tempo verify` inspected 15,316 journal records carrying 31 unique transaction
  hashes. All 31 receipts were found on Shannon with `success`; failures: 0.
- The live `PostOnlyWouldCross()` report records the SDK-decoded error but does
  not invent a failed-transaction hash that the thrown error did not expose.
