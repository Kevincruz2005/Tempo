# Changelog

## 0.2.0 - 2026-09-03

- Add EIP-1193/EIP-6963 wallet helpers and unsigned SDK order construction.
- Add deterministic settlement calibration with bounded persistence.
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
