# MCP Live Read Evidence

- Run at: 2026-09-03T10:17:45.124Z
- Network: configured Somnia testnet (read-only)
- Advertised catalog: 11 read/simulation tools; place_order absent
- Selected live market: BTC UNAVAILABLE (0x0000000000000000000000000000000000000000000000000000000000011ad5)
- Tools passed: 11/11
- Every result crossed MCP stdio and returned live/core-derived data; no network substitute was used.
- Status: PASS

## Tool Matrix

| Tool | Status | Attempts | Bounded evidence excerpt |
| --- | --- | ---: | --- |
| `discover_markets` | PASS | 1 | `[{"id":"0x0000000000000000000000000000000000000000000000000000000000012212","poolAddress":"0x23f45d1fec8aebfc82a042fa684ab05d8ccc3e73","lastPrice":null,"lastTradeAt":null,"cumulativeBaseVolume":"0","cumulativeQuoteVolume":"0","tradeCount":"` |
| `inspect_event_contract` | PASS | 3 | `{"market":{"id":"0x0000000000000000000000000000000000000000000000000000000000011ad5","poolAddress":"0x8eb893db72752b1d2b3ac11f625af90db1beb404","lastPrice":"780000","lastTradeAt":"1788426000","cumulativeBaseVolume":"480537000","cumulativeQu` |
| `get_live_book` | PASS | 1 | `{"marketId":"0x0000000000000000000000000000000000000000000000000000000000011ad5","question":"BTC closes at or above its opening price","source":"on-chain book via markets SDK","book":{"yesBids":[{"price":"597000","quantity":"200000000"},{"p` |
| `get_market_state` | PASS | 1 | `{"marketId":"0x0000000000000000000000000000000000000000000000000000000000011ad5","question":"BTC closes at or above its opening price","state":{"status":1,"pool":"0x8EB893Db72752b1d2b3AC11F625af90dB1BEB404","marketAddress":"0x36Fa3eA8bedEcA` |
| `get_fair_value` | PASS | 3 | `{"label":"AI ESTIMATE","status":"NO DATA","reason":"insufficient valid official price-feed history","inputs":{"spot":77517.15,"strike":77317.24,"sigma":"UNAVAILABLE","secondsLeft":49360.457000017166,"samples":240},"provenance":{"spot":"offi` |
| `get_risk_state` | PASS | 1 | `{"source":"TEMPO config","dryRun":false,"hasMakerSigner":false,"hasTakerSigner":false,"caps":{"quoteSize":25,"maxNetInventory":60,"maxGrossInventory":120,"firmCapitalCap":2000,"maxOrderCollateral":60,"maxOpenOrdersPerWindow":8,"maxLossPerWi` |
| `get_positions` | PASS | 2 | `[{"marketId":"0x0000000000000000000000000000000000000000000000000000000000012214","symbol":"ETH-238952-03SEP26-1018/tUSDC","up":0,"down":0,"status":1},{"marketId":"0x0000000000000000000000000000000000000000000000000000000000012213","symbol"` |
| `get_settlement` | PASS | 1 | `{"marketId":"0x0000000000000000000000000000000000000000000000000000000000010fad","state":{"status":4,"pool":"0x2AA87ab604568374Bbe98CaF308273cc0Dd7085a","marketAddress":"0x4a311cD20566Dc1c2f340B00122c39a34e1F9326","outcomeToken":"0xB52c5934` |
| `get_activity` | PASS | 1 | `[{"ts":"2026-09-03T10:16:43.173Z","eventId":"f9facf9d-bcfc-4ade-a803-7f599f93a999","type":"mcp","agent":"MCP","source":"mcp-stdio","data":{"tool":"inspect_event_contract","argsHash":"7bab0b2521349d1fa0d18f10ac6b4893ad1498e37df3e91a640724192` |
| `verify_receipt` | PASS | 1 | `{"hash":"0x3d2cc41de74db30eb8811609cdee105e9657a7dce2b463236b3a5618a6b26079","status":"success","block":"477741474"}` |
| `simulate_trade` | PASS | 1 | `{"mode":"DRY_RUN","verdict":{"ok":true},"market":"BTC-0-04SEP26/tUSDC","outcome":"UP","size":0.001,"price":0.5,"expireTimestampNs":"1788430673000000000","secondsLeft":49334.87800002098,"worstCaseCost":0.0005}` |
