# Changelog

## 0.3.1 - 2026-09-06

- Improve live exchange reads with the HTTP fast path for on-chain views.
- Correct timestamp handling used by the diffusion fair-value model.
- Unblock the pricing cycle when live exchange data is available.
- Clarify quantitative estimate and cold-path report labels.
- Refresh the SDK installation documentation for the `sdk-v0.3.1` release.

## 0.3.0 - 2026-09-03

- Add emergency write pause, strict endpoint/configuration validation, and
  browser-wallet call allowlisting with review-before-confirmation.
- Add journal event and decision identifiers plus transaction contract/model
  provenance for agent and MCP activity.
- Add bounded MCP schemas, payload limits, tool deadlines, and a read-only
  default catalog backed by live Somnia/DreamDEX data.
- Improve rolling calibration with duplicate-window suppression and directional
  fill scoring.

## 0.2.0 - 2026-09-03

- Add EIP-1193/EIP-6963 wallet helpers and unsigned SDK order construction.
- Add learned rolling settlement calibration with duplicate-window gating and bounded persistence.
- Add receipt verification and explicit RiskEngine-backed trade preparation.

## 0.1.0 - 2026-09-03

Initial public GitHub Release of the TEMPO Node SDK.

- Normalized DreamDEX Event Contract discovery, market state, books, opening
  boundaries, price feed, balances, fills, candles, and finalized history.
- Chain-gated post-only quotes, IOC trades, cancellation, mint/burn, testnet
  faucet, settlement inspection, and explicit outcome redemption.
- Decimal-aware tick and lot quantization for 6- and 18-decimal collateral.
- Deterministic GENESIS maker and VECTOR taker policies.
- Fair-value estimation from real feed history and on-chain boundaries.
- Shared risk engine, typed errors, agent ledger, provenance, JSONL journal,
  replay, and real-data backtesting.
- Compiled ESM JavaScript and TypeScript declaration files for Node 20+.
