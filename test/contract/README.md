# Contract Suite

Run `npm run test:contract` with two distinct funded Shannon keys. The runner
executes faucet, mint-set, post-only quote, cancel, maker ask, VECTOR IOC take,
settlement wait, and explicit outcome redemption. It saves only confirmed real
hashes to `test/reports/contract-live.md`.

No signer means `BLOCKED`; the runner never substitutes a wallet or fabricates
evidence.

