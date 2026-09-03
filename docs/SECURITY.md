# TEMPO Security Operations

This document defines the implemented controls and operator procedures for the
TEMPO release candidate. "Zero known vulnerabilities" means no unresolved
finding from the recorded scans and tests; it is not a claim that defects are
impossible.

## Trust Boundaries

- The official Somnia/DreamDEX RPC, indexer, price feed, contracts, and markets
  SDK are upstream dependencies. Their data is untrusted until shape, range,
  chain identity, and status checks pass.
- GENESIS and VECTOR use different keys. MCP cannot receive a key and advertises
  its write tool only after explicit operator opt-in plus signer presence.
- The browser receives unsigned, allowlisted calls only. Human confirmation is
  separate from review. Agent keys never cross the HTTP boundary.
- The built-in HTTP server is an operator-local read surface, not an Internet
  authentication service. Remote ingress requires an authenticated TLS proxy.

## Implemented Controls

The application fails closed on missing signers, non-trading markets, expired
orders, unsafe destinations, insufficient wallet balances, bad grid values,
risk-cap violations, malformed provider results, ambiguous receipts, and the
emergency pause. Every transaction is submitted through the pinned official
SDK and receipt-checked.

HTTP controls include Host/origin validation, GET-only routing, path
containment, CSP and isolation headers, request and stream limits, bounded URLs
and headers, sanitized errors, and recursive secret-field redaction. MCP adds
strict Zod schemas, an allowlisted catalog, a 16 KiB payload cap, and a 10-second
timeout. There is no SQL/database, shell execution, template evaluation,
arbitrary proxy, upload, or custom-contract surface.

## Emergency Stop

1. Set `TEMPO_PAUSED=true` and restart the process. Every core write method then
   returns `RISK_REJECTED` before SDK submission.
2. Stop all TEMPO processes and keep the HTTP upstream bound to loopback.
3. Inspect `journal/*.jsonl` and independently verify all recent transaction
   hashes with `npm run cli -- verify`.
4. Cancel remaining orders from a known-clean environment if chain state still
   permits it. Do not disable the pause until incident scope is understood.

## Key Rotation

1. Pause and stop the firm.
2. Generate two new dedicated testnet/operator accounts in a secure wallet or
   secret manager. Never place keys in shell arguments, source, CI variables
   visible to forks, screenshots, or support messages.
3. Fund gas/collateral using official testnet paths and update the secret store.
4. Confirm the two addresses differ, run `doctor`, keep dry-run enabled, and
   review balances and market status.
5. Revoke/remove old operator authorization where supported, then securely
   delete old local secret material. Resume only after the live probe and
   chain-gate checks pass.

TEMPO currently constrains raw testnet operator keys with application-level
capital, inventory, order, loss, destination, expiry, and pause controls.
Chain-native session-key authorization is a production hardening item and is
not claimed as implemented.

## Compromised-Key Response

Activate the emergency stop, isolate the host, rotate both agent keys (nonce and
self-match assumptions require treating the pair as a unit), inventory open
orders/positions from chain, cancel or settle from a clean account where
authorized, preserve journals read-only, and publish the affected address and
transaction interval. Never delete evidence or label an unknown receipt as
successful.

## Release Gate

```bash
npm run security:secrets
npm run typecheck
npm test
npm run test:coverage
npm audit --audit-level=high
npm pack --workspace @tempo/core --dry-run
```

GitHub Actions runs the same offline gate. Funded testnet validation is kept out
of untrusted pull-request CI and run explicitly with isolated keys. The project
deploys no custom smart contract, so Slither, reentrancy, ownership, and upgrade
analysis are `N/A`; precision, expiry, state transitions, and economic
invariants at the integration boundary are tested.

## Reporting

Do not include a private key, mnemonic, access token, `.env`, or full secret
manager output in an issue. Report the affected version/commit, public address,
transaction hash, timestamp, observed behavior, and reproduction steps with
credentials removed.
