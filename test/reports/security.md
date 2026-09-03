# Security Gate Evidence

- Run date: 2026-09-03
- Scope: release-candidate source and dependency boundary
- Status: PASS

## Executed Gate

| Check | Result | Evidence |
| --- | --- | --- |
| Secret scan | PASS | `npm run security:secrets`: 164 repository files inspected; no credential finding |
| Type safety | PASS | `npm run typecheck`: core, engine, CLI, and MCP compiled under strict TypeScript |
| Dependency audit | PASS | `npm audit --audit-level=high`: no high-or-higher vulnerability reported |
| Offline security tests | PASS | included in `npm test`: 2,107/2,107 total tests passed |
| Critical-core coverage | PASS | `npm run test:coverage`: 87.35% statements, above the 85% release threshold |
| Browser script syntax | PASS | `node --check packages/web/public/wallet.js` |

## Enforced Controls

- Write paths re-read live Trading status, quantize tick/lot inputs, require an
  expiry, and receipt-check SDK submissions.
- `TEMPO_PAUSED=true` blocks core writes before SDK submission.
- Browser-wallet calls are chain-checked, separately reviewed and confirmed,
  balance-checked, and destination-allowlisted.
- MCP is read/simulate-only by default; write exposure requires explicit opt-in
  and a signer. Tool inputs use strict schemas, a 16 KiB cap, and a 10-second
  deadline.
- The local HTTP surface is GET-only and bounded; it validates Host/origin,
  limits streams, contains paths, emits CSP/isolation headers, and redacts
  sensitive fields.

Operational key rotation, incident response, and the emergency-stop procedure
are documented in `docs/SECURITY.md`. No unsupported claim of session-key
authorization is made.
