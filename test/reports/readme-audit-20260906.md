# README and Release Verification

- Run date: 2026-09-06
- Scope: root README accuracy, local links, build, tests, secret scan, dependency audit, public entry points, and documented interface counts
- Result: **PASS**

## Current automated verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS — core, engine, CLI, and MCP compile successfully |
| `npm test` | PASS — 18 files, 2,118 tests |
| `npm run security:secrets` | PASS — 131 repository files inspected after repository cleanup |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| README local-link target check | PASS |
| `git diff --check` | PASS |

## README accuracy checks

- Headline operating metrics are explicitly tied to the dated 2026-09-05 business-impact snapshot.
- The test badge and test claim match the current 2,118-test suite.
- The CLI surface matches the 17 top-level commands returned by `tempo --help`.
- The MCP table matches the ten read tools, one simulation tool, and one opt-in write tool defined by `packages/mcp/src/index.ts`.
- The SDK section distinguishes repository package version 0.3.1 from the latest packaged GitHub artifact, v0.3.0.
- Model outputs are labeled as estimates and kept distinct from price-feed and on-chain facts.
- Zero-inventory language is scoped to pre-held outcome tokens; collateral and fill risk are not described as zero.
- Local journal files are described as application append-only, not immutable.
- Testnet performance and calibration figures are not presented as guaranteed mainnet or future results.

## Public entry-point check

The following entry points responded during the verification pass:

- `https://tempo-somnia.vercel.app`
- `https://20-189-112-129.sslip.io/health`
- `https://youtu.be/YchdanIf05A`
- GitHub release artifact `sdk-v0.3.0/tempo-core-0.3.0.tgz`

This report proves the repository checks executed on the stated date. Dynamic chain, journal, and deployment state can change after the run; historical economic metrics remain tied to their separately timestamped evidence reports.
