# Funded Post-Only Failure Evidence

- Run at: 2026-09-02T10:57:21.304Z
- Network: Somnia Shannon testnet (50312)
- Market: `BTC-0-02SEP26-1100-1199/tUSDC`
- Market id: `0x0000000000000000000000000000000000000000000000000000000000011199`
- Signer: GENESIS `0xE7a8a7d81Bad87512f9cab931E5122B5eaEE8c7a`
- Observed result: official SDK decoded `PostOnlyWouldCross()` from the live
  contract receipt path; the runner stopped rather than treating it as a fill.
- SDK error transaction hash: unavailable on the thrown `ContractRevertError`;
  no hash is invented.

## Confirmed Setup Hashes

- GENESIS faucet: `0x78f5da3b8db9906375b306736c6218734643e8ac50841ebd1128f1768a5e241e`
- VECTOR faucet: `0xc2183fd308731574075deacf800cf30940cd6b79b77b67e3e165db418c89d77b`
- GENESIS mintSet: `0x48e32d8058b9219a6b8b804f94f70e2541f222bef608f46dfcd3719a6a879046`
- GENESIS post-only quote: `0x0bfb88348a057df029c1c1e50fa60c759f87ae09faf853a57d6ecff9c7cbedfd`
- GENESIS cancel: `0x0ef8aca7c018d082a5a71f0d587f751fcf49535cd27c76dcfc77d330c2ba1bb0`
