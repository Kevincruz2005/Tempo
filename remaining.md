# Remaining Work

TEMPO's end-to-end financial execution path is verified on Somnia Shannon
testnet. The items below remain before the strict master checklist can be
declared fully complete.

## Submission Blockers

1. **Make the GitHub repository public.** Then verify anonymous clone access
   and public download access for the `sdk-v0.3.0` release assets.
2. **Publish a hosted deployment.** Verify the public dashboard,
   `/docs.html`, `/health`, and `/ready` endpoints. The current application and
   documentation are verified locally only.
3. **Run a real browser-wallet E2E flow.** Capture evidence for provider
   connection, Shannon network selection, review, user approval, submission,
   successful receipt, and state refresh. Do not fabricate a wallet screenshot
   or receipt.
4. **Verify a clean anonymous clone.** From a new directory: clone, install,
   configure from `.env.example`, build, test, launch the application, and run
   the documented testnet reproduction path.

## Strict Checklist Gaps

5. **Add scoped operator/session-key authorization.** GENESIS and VECTOR
   currently use dedicated raw signer keys constrained by application risk
   limits and `TEMPO_PAUSED`. Implement native scoped authorization where the
   supported protocol path permits it.
6. **Complete per-method SDK documentation.** The portal lists the public API,
   but the master checklist requires types, errors, and examples for every
   exported module and method.
7. **Complete the extended security pipeline.** Add an explicit lint/format
   gate, dedicated static security analysis, and an independent/manual security
   review. Custom-contract analyzers remain `N/A` because TEMPO deploys no
   custom smart contract.
8. **Broaden the 2,000-test distribution.** The suite passes 2,107 tests, but
   2,048 are deterministic economic-invariant cases. Add substantially more
   independent integration, contract, E2E, failure, security, CLI, and SDK
   cases if strict adherence to the checklist's suggested distribution is
   required.
9. **Refresh final evidence after the preceding work.** Re-run all offline,
   live, security, wallet, deployment, receipt, and clean-clone gates; update
   `test/reports/final-checklist.md`, `test/reports/submission-gate.md`, and
   `docs/FINAL.md`; then commit, push, and confirm CI passes.

## Architecture Clarification

The complete trading lifecycle is on-chain: market state, balances, minting,
orders, cancellation, fills, settlement, redemption, and receipt verification.
TEMPO as a whole is intentionally hybrid rather than 100% on-chain: discovery,
official feed access, estimation, calibration, risk evaluation, agents, MCP,
CLI, dashboard, and journal processing run off-chain.
