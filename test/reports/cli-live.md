# CLI Live Report

- Run at: 2026-09-05T17:21:01.250Z

## doctor

- Status: PASS
- Exit: 0

```text
TEMPO doctor — probing chain, indexer, feed, keys
network:        testnet
indexer:        https://dev.smk.somnia.host/v1/graphql
rpc:            https://50312.rpc.thirdweb.com
ws rpc:         wss://api.infra.testnet.somnia.network/ws
price feed:     https://price-feed.dev.oracle.somnia.host/v1/graphql
dry run:        false
maker key:      present
taker key:      present
live markets:   10 (managed assets: BTC,ETH)
collateral:     0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E (6 decimals)
feed BTC:     80065.44 (ema 80077.61)
feed ETH:     2478.54 (ema 2479.15)
maker balance:  48585.89 collateral

```
## markets

- Status: PASS
- Exit: 0

```text
symbol                                  asset cad  left   venue       marketId
ETH-247945-05SEP26-1718/tUSDC           ETH   1m   29s    0x1a1e6821  0x0000000000
BTC-8008246-05SEP26-1718/tUSDC          BTC   1m   29s    0x1a1e6821  0x0000000000
BTC-8014494-05SEP26-1720/tUSDC          BTC   5m   149s   0x1a1e6821  0x0000000000
ETH-248089-05SEP26-1720/tUSDC           ETH   5m   149s   0x1a1e6821  0x0000000000
BTC-0-05SEP26-1800/tUSDC                BTC   60m  2549s  0x679795a0  0x0000000000
ETH-0-05SEP26-1800/tUSDC                ETH   60m  2549s  0x679795a0  0x0000000000
ETH-0-05SEP26-2000/tUSDC                ETH   240m 9749s  0x679795a0  0x0000000000
BTC-0-05SEP26-2000/tUSDC                BTC   240m 9749s  0x679795a0  0x0000000000
ETH-0-06SEP26/tUSDC                     ETH   1440m24149s 0x679795a0  0x0000000000
BTC-0-06SEP26/tUSDC                     BTC   1440m24149s 0x679795a0  0x0000000000
ETH-0-19OCT26/tUSDC                     ETH   64800m3739349s0x09567c41  0x0000000000
BTC-0-19OCT26/tUSDC                     BTC   64800m3739349s0x09567c41  0x0000000000

12 live windows — the venue's own rolling series

```
## book

- Status: PASS
- Exit: 0

```text
market:   BTC-8008246-05SEP26-1718/tUSDC  (BTC 1m, 0s left)
strike:   80082.46
spot:     80034.32  [price-feed]
grid:     tick 0.001 lot 0.001 (6 decimals)

YES book (Up probability):
  --- touch ---
  EMPTY BOOK — no liquidity yet (the genesis gap)

```
## agents

- Status: PASS
- Exit: 0

```text
== GENESIS
   address:    0xE7a8a7d81Bad87512f9cab931E5122B5eaEE8c7a
   collateral: 48584.49 (6 decimals)
== VECTOR
   address:    0x54001362B87792d4Cb2c9bC8ed06421a899156E7
   collateral: 49999.71 (6 decimals)

```
## positions

- Status: FAIL
- Exit: timeout

```text
== GENESIS
   address:    0xE7a8a7d81Bad87512f9cab931E5122B5eaEE8c7a
   collateral: 48584.49 (6 decimals)

```
## claims

- Status: PASS
- Exit: 0

```text
0x000000000000  winner DOWN  held UP UNAVAILABLE / DOWN UNAVAILABLE
   oracle: https://prd.oracle.somnia.host/questions/68868199934477279842620711836930495327138688021576976514371682099009716367800?view=graph
0x000000000000  winner DOWN  held UP UNAVAILABLE / DOWN UNAVAILABLE
   oracle: https://prd.oracle.somnia.host/questions/26640155858661585724225379688567501256414994594752398210624278424878081413003?view=graph
0x000000000000  winner DOWN  held UP UNAVAILABLE / DOWN UNAVAILABLE
   oracle: https://prd.oracle.somnia.host/questions/76768056836382069260662224244166981724654935873985440755611057259340981077582?view=graph

```
## activity

- Status: PASS
- Exit: 0

```text
17:19:13 market-birth    firm    ETH-247844-05SEP26-1720/tUSDC {"asset":"ETH","intervalSec":60,"expiry":1788628800,"venueId":"0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7
17:19:13 market-birth    firm    BTC-8007138-05SEP26-1720/tUSDC {"asset":"BTC","intervalSec":60,"expiry":1788628800,"venueId":"0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7
17:19:13 price           firm     {"asset":"ETH","price":2477.7149999999997,"ema":2477.820712486479,"ts":1788628751000}
17:19:14 price           firm     {"asset":"BTC","price":80052.7275,"ema":80055.31685153564,"ts":1788628753000}
17:19:14 price           firm     {"asset":"ETH","price":2477.6949999999997,"ema":2477.8049984256686,"ts":1788628753000}

```
## verify

- Status: FAIL
- Exit: timeout

```text
journal records (7d): 123007, carrying tx hashes: 1512
  0x78f5da3b8db9906375b306736c6218734643e8ac50841ebd1128f1768a5e241e block=477736005 status=success
  0xc2183fd308731574075deacf800cf30940cd6b79b77b67e3e165db418c89d77b block=477736020 status=success
  0x48e32d8058b9219a6b8b804f94f70e2541f222bef608f46dfcd3719a6a879046 block=477736185 status=success
  0x0bfb88348a057df029c1c1e50fa60c759f87ae09faf853a57d6ecff9c7cbedfd block=477736383 status=success
  0x0ef8aca7c018d082a5a71f0d587f751fcf49535cd27c76dcfc77d330c2ba1bb0 block=477736529 status=success
  0x7a78a4f4ca13cc59c94ee6d1a78c03bead20112ef71ae1adcd1f3850b4f6561a block=477740388 status=success
  0xb51c35c96f3bcd8b061c4f956b946d2177d1276f7ca1c9849ee16aeb160375b1 block=477740400 status=success
  0xe4cfacbcccf7100a16bdec6d91b77b7a36d1137125cd6f072115b05c14c31710 block=477740614 status=success
  0x61df8841b3fe0b505415ce28f983c888f24c8bce712d32003cdce6416af9e0b7 block=477740795 status=success
  0xec1a645007bc031ddf1ea16e5d21b1bdf6291f634dee9c03955c37f1506028ed block=477740941 status=success
  0x55343bb33a3683fd4077f28e724e931b7d9977b7e0d812252369a8f05268ac23 block=477741128 status=success
  0x3d2cc41de74db30eb8811609cdee105e9657a7dce2b463236b3a5618a6b26079 block=477741474 status=success
  0xce7bc42481c72c872b9b5673b1d930d9046e110ebedd286bfcd8e0ed70393570 block=477741617 status=success
  0xa37ecf00775bd510c1d02101c52abd6eee7c447c1dca9138afee8a45214b7aa3 block=477754559 status=success
  0x9d50bdd28b21e0bfa31e93d0e755dcbe6eeb0a441f46cd4e96c14ef4a235b175 block=477755832 status=success
  0xdec9f670f195f7d7599445edd83b170cf14672b53715fcbc1bdca0e4145d26a4 block=477755863 status=success
  0xc767717e972b47d0f7daabf533684195de19e9b75efeece5ad794243bad1783b block=477763816 status=success
  0xe64114b4a250d7c9a2f490fe700e9eaa62c3cf9e2ec7bd7d32b1ec9b7d6b518b block=477768213 status=success
  0x3e969f122aec0ddb6be5dc8876bcbc943d5d6e8f7a725dd3458c2e4a5ddb2f06 block=477937852 status=success
  0xc8437cd79503a353b2f404ede678f2b43e6c95f19785063c62dd36b63e1163d6 block=477937924 status=success
  0x1d5f7cceafa63163c4248981fb32e63f4922a3a5e2f71c4f4e74ddd0814a2b2a block=477937953 status=success
  0xcb779b173af5d4a82f18d3153fa27aa3fc8f8ac3fa2d8d77e0f2f7a380083414 block=477938085 status=success
  0x575ffcb8b628c607cfe7b086c526184c0f912502a759fdbba208477a9519176e block=477938211 status=success
  0x53c56b2b8f0e53d98674379496104ed4c53b12ca164109e02b1a6d0c690c6eda block=477938328 status=success
  0xd631bd14938dadbbe639af45f7c20e3b00cadcd41a9923e406d38d4cf16e25d2 block=477938459 status=success
  0x25af322e8fe9fc69c52c2d0bb4f5c873ade8e84cd5a435d2aa53b774b96a3d93 block=477938543 status=success
  0x4c827d11235c3ef505bef8f03eea37845709a47d2c9f55c3ffa99beffb85c70e block=477938626 status=success
  0x084fb4a5f516308357fc3ad0e7d78114ae1a1f2806aa7b1a8d39c5b0fd9ee4c0 block=477938655 status=success
  0x99bf3d5e4b1d817551f9b06c7613e7aa7997f67472f049ce7452e591e2bce4e1 block=477938725 status=success
  0x71595cc78379132b0b2053480ba51177ff9b84a19c2ecfa1ff15ddec977ada7c block=477938756 status=success
  0xd9aad1477ac2e99a8ec4281b5c447ca9b5c3d625600eb59ae9a938889bf2ac5e block=477940746 status=success
  0xa400d371dcc4ed7a0131c5d82fd11df00e2da577eeef2888a965d110a2d228a2 block=477950815 status=success
  0xc199d20a4f271977e2726808a8ac660ae4a2626d95af142e0e873879e79c0b8a block=477990229 status=success
  0xd3a7c8515e3d7a1707375a87f57046868ba4f19d2379180cc08a64bbd0dfe7cd block=477990383 status=success
  0xbe2d3f013403f13346b9b3ab97603bddce73ec623d4dafbc9a773b809cae757d block=477990411 status=success

```
## settlements

- Status: PASS
- Exit: 0

```text
ETH 1m expired 2026-09-05T17:19:00.000Z  trades 0  last —
   oracle: https://prd.oracle.somnia.host/questions/87177662882563012953078137895112589548109369050712158231655610604770463973155?view=graph
BTC 1m expired 2026-09-05T17:19:00.000Z  trades 0  last —
   oracle: https://prd.oracle.somnia.host/questions/59706334112249240150116655552816296269364816816209152020948200679022916384558?view=graph
ETH 1m expired 2026-09-05T17:18:00.000Z  trades 0  last —
   oracle: https://prd.oracle.somnia.host/questions/68868199934477279842620711836930495327138688021576976514371682099009716367800?view=graph

```
## backtest

- Status: PASS
- Exit: 0

```text
real-feed midpoint fair-value backtest (MODEL ESTIMATE; finalized outcome is chain fact)
ETH  2026-09-05T17:20:00.000Z  estimate 0.2244 outcome 0 brier 0.0504 samples 88
ETH  2026-09-05T17:20:00.000Z  estimate 0.3430 outcome 0 brier 0.1176 samples 418
BTC  2026-09-05T17:20:00.000Z  estimate 0.0246 outcome 0 brier 0.0006 samples 88
mean Brier 0.0562 over 3 real windows

```
## watch

- Status: PASS
- Exit: timeout

```text

```
## firm

- Status: PASS
- Exit: timeout

```text
TEMPO firm — SIMULATE (decisions journaled, nothing sent)
dashboard: http://127.0.0.1:7533

```
