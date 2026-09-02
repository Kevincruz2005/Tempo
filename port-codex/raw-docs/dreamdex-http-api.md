> For the complete documentation index, see [llms.txt](https://docs.dreamdex.io/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.dreamdex.io/developers/http-api.md).

# HTTP API

The DEX HTTP API provides a programmatic REST interface that allows integrators to list the currently-available markets and currencies, prepare orders for transmission, and receive real-time updates about all orders placed on Somnia.

See also the [WebSocket API](/developers/websocket-api.md) for truly real-time communication with the DEX.

Note that, unlike some DEX services, the HTTP API is not sufficient to place an order - the client is expected to be able to connect to the Somnia network and transmit their order themselves. See the [Trading](/developers/http-api/trading.md#post-v0-markets-symbol-orders) method for more information.

## Base URLs

Every REST endpoint is served under the `/v0` path prefix. Pick the row for your target environment and prepend the base URL to the operation paths shown throughout these docs (e.g. `GET /v0/markets` becomes `https://api.dreamdex.io/v0/markets`).

| Environment              | Chain ID | REST base URL                    | WebSocket public feed                    |
| ------------------------ | -------- | -------------------------------- | ---------------------------------------- |
| Mainnet (Somnia)         | `5031`   | `https://api.dreamdex.io/v0`     | `wss://api.dreamdex.io/v0/ws/public`     |
| Testnet (Somnia Shannon) | `50312`  | `https://stg.api.dreamdex.io/v0` | `wss://stg.api.dreamdex.io/v0/ws/public` |

{% hint style="warning" %}
The `/v0` segment is required on both environments. Omitting it (e.g. `https://stg.api.dreamdex.io/markets`) returns a 404.
{% endhint %}

The examples in these docs use the mainnet base URL. To target testnet, substitute the staging base URL above (and the [testnet contract addresses](/developers/contracts/contract-specifications.md#testnet-somnia-shannon-chain-id-50312)). The [Quick Start](/developers/quick-start.md) parameterises this as a `$BASE_URL` shell variable so a single set of commands works against either environment.

For the live markets and currency codes accepted by `{symbol}` path parameters, see [Markets and currency codes](/developers/http-api/market-data.md#markets-and-currency-codes).


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.dreamdex.io/developers/http-api.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
