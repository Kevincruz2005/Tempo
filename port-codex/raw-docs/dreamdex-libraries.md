> For the complete documentation index, see [llms.txt](https://docs.dreamdex.io/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.dreamdex.io/developers/libraries.md).

# Libraries

Client libraries that wrap the dreamDEX [HTTP API](/developers/http-api.md) and [WebSocket API](/developers/websocket-api.md) into higher-level, language-native interfaces.

* [**CCXT**](/developers/libraries/ccxt.md) — TypeScript / JavaScript integration via the popular unified exchange library.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.dreamdex.io/developers/libraries.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
