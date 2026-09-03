# Health and Readiness Evidence

- Run at: 2026-09-03T04:25:36Z
- Mode: local `TEMPO_DRY_RUN=true` firm; no writes attempted
- Host: `127.0.0.1`

## Live curls

```text
GET /health
{"status":"ok","service":"tempo","version":"1.0.0"}

GET /ready
{"status":"ready","service":"tempo","checkedAt":"2026-09-03T04:25:36.044Z","checks":{"indexer":true,"rpc":true,"prices":{"BTC":true,"ETH":true},"liveTail":true}}
HTTP 200

GET /docs.html
HTTP 200 bytes 47912
```

`/health` performs no dependency reads and returns no URLs, keys, addresses, or
journal contents. `/ready` caches its dependency result for five seconds. The
readiness output above came from the live indexer, Somnia RPC, official BTC/ETH
price feeds, and the SDK live tail; optional LLM configuration is not checked.

## Boundary tests

`test/integration/health.test.ts` covers health version shape, safe 503 output,
five-second probe caching, and malformed HTTP methods. The dependency-failure
case uses only an injected probe boundary; it does not mock economic data.

