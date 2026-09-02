> For the complete documentation index, see [llms.txt](https://docs.dreamdex.io/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.dreamdex.io/welcome/readme.md).

# Introduction

{% hint style="info" %}
**Living document.** This documentation tracks dreamDEX as it ships. Sections may change as the protocol evolves.
{% endhint %}

**dreamDEX is the endgame DEX: CEX performance with DEX decentralisation, and zero fees. dreamDEX is a fully on-chain CLOB where the book pays its own makers and the protocol takes nothing off the top. It's powered by** [**Somnia**](https://docs.somnia.network/)**, the Agentic L1.**

## The DEX vs CEX trade-off is over

Most on-chain venues still ask you to compromise, by routing your orders through a centralised matching engine or asking you to trust an opaque sequencer. dreamDEX doesn't. The same code path serves a $10 retail order and a $10m institutional fill. Market makers earn yield for posting tight quotes, and anyone can become one.

dreamDEX is designed to win on every axis (execution quality, decentralisation, and cost) for every kind of user: institutions, market makers, algorithmic desks, autonomous agents, and retail.

## What's live at launch

* **Fully on-chain spot CLOB.** The order book lives at the smart contract level on Somnia. It's auditable end-to-end.
* **CLOB is yield-bearing.** USDso yield is redistributed to active market makers each period, weighted by proximity to mid-price.
* **Zero maker / zero taker fees.** dreamDEX is funded by the yield on resting capital, not by taxing flow.
* **Gas sponsorship on SOMI and stablecoin pairs.** The protocol sponsors gas on the core assets of the Somnia economy. Elsewhere, gas fees are still paid by users in the native **SOMI** token, but are negligible compared to fees charged by alternative DEXs/CEXs.
* **USDso-native settlement.** Frax-backed stablecoin makes zero fees economically viable.
* [**Reactivity**](https://docs.somnia.network/developer/reactivity) **as a primitive.** Data is pushed to your agents in real time. When a price level, fill, or book event happens on Somnia, your strategy can react in literally the same block, with no polling required.
* **Native agent and algo access.** MCP server, `AGENTS.md` / `SKILL.md`, CCXT-compatible bindings, REST and WebSocket endpoints. Existing bot infrastructure works without modification.

## Values

* **Transparency.** Every rule governing the venue — matching, fees, yield allocation, settlement — is encoded on-chain and enforced algorithmically.
* **Credible neutrality.** There's no private matching engine, and no 'forced API' gating. The same code path runs whether you're posting $10 or $10m.
* **Zero-fee, by design.** dreamDEX is Somnia's on-chain liquidity layer, not a fee-taking destination. Third-party apps are welcome to build on top of our book and keep the spread for themselves.
* **High performance.** Real serial transactions on an L1 capable of 1M TPS with sub-second finality.
* **Agents-first.** Autonomous agents and LLMs are first-class participants alongside humans through our skills library.

## Build on dreamDEX

dreamDEX is intended as liquidity infrastructure. Frontends, DEXs, vaults, aggregators, structured-product issuers, and agent apps can route order flow through dreamDEX and keep the spread, the rebate, or the user relationship for themselves.

## Quick Links

* [Why dreamDEX](/welcome/why-dreamdex.md): what we are, what we aren't, and how we compare to other exchanges
* [Quick Start](/developers/quick-start.md): how to connect, fund, and place your first order
* [Roadmap](/welcome/roadmap.md): where we're going with this
* [Trading](/trading/trading.md): how the book works, how yield works, how fees work (there aren't any)
* [Developers](/developers/developers.md): APIs, contracts, libraries, MCP, AGENTS.md

## License

Copyright (c) 2026 DreamDEX S.A. (Panama). See [LICENSE.md](https://github.com/somnia-chain/somnia-dex-docs/tree/main/LICENSE.md).


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.dreamdex.io/welcome/readme.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
