# Zero-Mock Audit

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
