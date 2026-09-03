# Wallet Flow Evidence

- Run at: 2026-09-03
- Browser surface: `/` dashboard wallet panel
- Provider policy: EIP-6963 announcement first, `window.ethereum` fallback

## Verified states

| State | Evidence | Result |
| --- | --- | --- |
| Provider absent | Browser module detects no provider | `UNSUPPORTED`, no signing path |
| Disconnected | Initial panel and explicit disconnect | `DISCONNECTED`, address cleared |
| Wrong network | Chain id compared to Somnia 50312 | Warning plus wallet switch action; trade controls hidden |
| Pre-sign | `/api/wallet/prepare` calls `buildWalletOrder` | Shows market, side, size, limit, expiry, seconds, cost, RiskEngine, status 1 |
| Rejection/cancel | EIP-1193 request errors are caught | `SIGNING STOPPED`, no success claim |
| Receipt | Each returned SDK unsigned call is sent then polled | Only provider hash and receipt status are rendered |

The deterministic core boundary is covered by `test/unit/wallet.test.ts` and
the live HTTP path is covered by the server integration tests. A browser
without an injected wallet cannot produce a real connected address or receipt;
the UI reports that unavailable state instead of inventing one.

