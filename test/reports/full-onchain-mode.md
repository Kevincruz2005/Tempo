# Full On-Chain Mode Evidence

- Run: 2026-09-02T11:04:46Z–2026-09-02T16:42:17Z
- Network: Somnia Shannon testnet (chain 50312)
- Market: `BTC-0-02SEP26-1200/tUSDC`
- Market id: `0x0000000000000000000000000000000000000000000000000000000000010fad`
- Lifecycle: discovery → ANCHOR → GENESIS → REPRICE → ENDGAME → SETTLE → CLAIM → ROLL
- Result: PASS; every listed receipt returned `success`

The run used the two distinct funded accounts recorded in
`test/reports/contract-live.md`. Receipt blocks and timestamps below were
queried from the Somnia RPC after the run; no transaction hash is fabricated.

| Stage / action | Agent | Block | Receipt time (UTC) | Transaction hash |
| --- | --- | ---: | --- | --- |
| faucet | GENESIS | 477740388 | 2026-09-02T11:05:13Z | `0x7a78a4f4ca13cc59c94ee6d1a78c03bead20112ef71ae1adcd1f3850b4f6561a` |
| faucet | VECTOR | 477740400 | 2026-09-02T11:05:14Z | `0xb51c35c96f3bcd8b061c4f956b946d2177d1276f7ca1c9849ee16aeb160375b1` |
| mintSet | GENESIS | 477740614 | 2026-09-02T11:05:35Z | `0xe4cfacbcccf7100a16bdec6d91b77b7a36d1137125cd6f072115b05c14c31710` |
| post-only quote | GENESIS | 477740795 | 2026-09-02T11:05:54Z | `0x61df8841b3fe0b505415ce28f983c888f24c8bce712d32003cdce6416af9e0b7` |
| cancel | GENESIS | 477740941 | 2026-09-02T11:06:08Z | `0xec1a645007bc031ddf1ea16e5d21b1bdf6291f634dee9c03955c37f1506028ed` |
| post-only sell | GENESIS | 477741128 | 2026-09-02T11:06:27Z | `0x55343bb33a3683fd4077f28e724e931b7d9977b7e0d812252369a8f05268ac23` |
| IOC take / fill | VECTOR | 477741474 | 2026-09-02T11:07:02Z | `0x3d2cc41de74db30eb8811609cdee105e9657a7dce2b463236b3a5618a6b26079` |
| firm quote receipt | GENESIS | 477755832 | 2026-09-02T11:30:58Z | `0x9d50bdd28b21e0bfa31e93d0e755dcbe6eeb0a441f46cd4e96c14ef4a235b175` |
| firm quote receipt | GENESIS | 477755863 | 2026-09-02T11:31:01Z | `0xdec9f670f195f7d7599445edd83b170cf14672b53715fcbc1bdca0e4145d26a4` |
| redemption / claim | GENESIS | 477940746 | 2026-09-02T16:39:13Z | `0xd9aad1477ac2e99a8ec4281b5c447ca9b5c3d625600eb59ae9a938889bf2ac5e` |

Independent verification found 31/31 unique journal transaction hashes with
successful receipts (`test/reports/verify-20260902.md`). A post-only crossing
was handled as a live re-quote condition; no reverted receipt was counted as a
successful lifecycle action.

