# MCP Live Read Evidence

- Run at: 2026-09-05T20:33:48.786Z
- Network: configured Somnia testnet (read-only)
- Advertised catalog: 11 read/simulation tools; place_order absent
- Selected live market: ETH UNAVAILABLE (0x0000000000000000000000000000000000000000000000000000000000013b55)
- Tools passed: 11/11
- Every result crossed MCP stdio and returned live/core-derived data; no network substitute was used.
- Status: PASS

## Tool Matrix

| Tool | Status | Attempts | Bounded evidence excerpt |
| --- | --- | ---: | --- |
| `discover_markets` | PASS | 1 | `[{"id":"0x0000000000000000000000000000000000000000000000000000000000014785","poolAddress":"0x474cba089d2c188e6cd44ab95b1abd472d9f3926","lastPrice":null,"lastTradeAt":null,"cumulativeBaseVolume":"0","cumulativeQuoteVolume":"0","tradeCount":"` |
| `inspect_event_contract` | PASS | 2 | `{"market":{"id":"0x0000000000000000000000000000000000000000000000000000000000013b55","poolAddress":"0xc5fa5aa238977bcc7c05290de2f1714b11559027","lastPrice":"550000","lastTradeAt":"1788631365","cumulativeBaseVolume":"1071130000","cumulativeQ` |
| `get_live_book` | PASS | 1 | `{"marketId":"0x0000000000000000000000000000000000000000000000000000000000013b55","question":"ETH closes at or above its opening price","source":"on-chain book via markets SDK","book":{"yesBids":[{"price":"450000","quantity":"50000000000"}],` |
| `get_market_state` | PASS | 1 | `{"marketId":"0x0000000000000000000000000000000000000000000000000000000000013b55","question":"ETH closes at or above its opening price","state":{"status":1,"pool":"0xC5Fa5aA238977bcC7C05290De2F1714b11559027","marketAddress":"0x161c6198c44D24` |
| `get_fair_value` | PASS | 1 | `{"label":"MODEL ESTIMATE","value":{"p":0.5876990815872865,"d":0.22163021752466966,"band":[0.2219465106005934,0.8955724475123618],"expectedMove":115.85821374683336},"inputs":{"spot":2476.1250000000005,"strike":2450.58,"sigma":0.0000242347678` |
| `get_risk_state` | PASS | 1 | `{"source":"TEMPO config","dryRun":false,"hasMakerSigner":false,"hasTakerSigner":false,"caps":{"quoteSize":25,"maxNetInventory":60,"maxGrossInventory":120,"firmCapitalCap":2000,"maxOrderCollateral":60,"maxOpenOrdersPerWindow":8,"maxLossPerWi` |
| `get_positions` | PASS | 1 | `[{"marketId":"0x000000000000000000000000000000000000000000000000000000000001477f","symbol":"ETH-247703-05SEP26-2035/tUSDC","up":0,"down":0,"status":1},{"marketId":"0x000000000000000000000000000000000000000000000000000000000001477e","symbol"` |
| `get_settlement` | PASS | 1 | `{"marketId":"0x0000000000000000000000000000000000000000000000000000000000010fad","state":{"status":4,"pool":"0x2AA87ab604568374Bbe98CaF308273cc0Dd7085a","marketAddress":"0x4a311cD20566Dc1c2f340B00122c39a34e1F9326","outcomeToken":"0xB52c5934` |
| `get_activity` | PASS | 1 | `[{"ts":"2026-09-05T20:32:32.812Z","eventId":"0be912f3-a3a8-45ba-a3db-7e43af0a1b2a","type":"mcp","agent":"MCP","source":"mcp-stdio","data":{"tool":"discover_markets","argsHash":"2a8276f650319ab72da96dfdddb5ea2b42884eb8b8691099d76cdb56df8ca66` |
| `verify_receipt` | PASS | 1 | `{"hash":"0x3d2cc41de74db30eb8811609cdee105e9657a7dce2b463236b3a5618a6b26079","status":"success","block":"477741474"}` |
| `simulate_trade` | PASS | 1 | `{"mode":"DRY_RUN","verdict":{"ok":true},"market":"ETH-0-19OCT26/tUSDC","outcome":"UP","size":0.001,"price":0.5,"expireTimestampNs":"1788640436000000000","secondsLeft":3727571.214999914,"worstCaseCost":0.0005}` |
