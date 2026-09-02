> For the complete documentation index, see [llms.txt](https://docs.dreamdex.io/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.dreamdex.io/trading/readme-1/operators.md).

# Operators & Session Keys

Operators let you **approve another key or contract to trade on your behalf** — without ever handing over custody of your funds. Approve a hot "session key" for a trading bot, let an aggregator route swaps for you (the [SpotRouter](/developers/contracts/spot-router.md) is itself an operator), or split a market-making setup into a cold **fund key** and a hot **operator key**.

Approvals are recorded once in the shared **`OperatorPermissionsRegistry`** and apply across every official SpotPool. Each capability is granted **per function selector**, so you approve exactly what an operator may do — place orders, cancel them, reduce them — and nothing more.

{% hint style="info" %}
**Operators never touch your funds.** An operator places and manages orders that are owned by, and settle to, *you*. Every fill, cancel, and reduce pays out to the order owner — never the operator. Deposits, withdrawals, and approvals stay `msg.sender`-scoped to the owner.
{% endhint %}

## Capabilities

| Capability    | Function                                                              | Selector     |
| ------------- | --------------------------------------------------------------------- | ------------ |
| Place orders  | [`placeOrderFor`](/developers/contracts/functions.md#placeorderfor)   | `0x80054449` |
| Cancel orders | [`cancelOrderFor`](/developers/contracts/functions.md#cancelorderfor) | `0xe37b444b` |
| Reduce orders | [`reduceOrderFor`](/developers/contracts/functions.md#reduceorderfor) | `0x364c2587` |

Each selector is an independent grant — approving `placeOrderFor` does **not** admit `cancelOrderFor` or `reduceOrderFor`. `placeOrderFor` additionally admits protocol system contracts via an owner-managed allowlist; `cancelOrderFor` / `reduceOrderFor` are admitted **only** by your per-user approval.

### Batch and amend variants

The batch and amend entrypoints reuse these same three grants — there is no separate batch or amend selector:

* `placeOrdersFor` reuses the `placeOrderFor` grant; `cancelOrdersFor` reuses `cancelOrderFor`; `reduceOrdersFor` reuses `reduceOrderFor`. One grant covers both the single and batch form.
* `amendOrderFor` / `amendOrdersFor` are an atomic cancel + replace, so they require the operator to hold **both** the `cancelOrderFor` **and** `placeOrderFor` grants for the owner. Holding `placeOrderFor` also lets the replacement's auto-pull draw from the owner's wallet, exactly as `placeOrderFor` does.

## Addresses

The registry stack is two contracts: the `OperatorPermissionsRegistry` (holds approvals) and the `SpotPoolRegistry` (the allowlist of official pools a *global* approval covers).

| Contract                      | Mainnet (`5031`)                             | Testnet (`50312`)                            |
| ----------------------------- | -------------------------------------------- | -------------------------------------------- |
| `OperatorPermissionsRegistry` | `0xE7a190736B6024a4DbafadC04E283075877005ce` | `0x15C7e8CE38F021c5b45d098AaD788f63090bF20A` |
| `SpotPoolRegistry`            | `0xB601bc1099B040E4882089D94690F7C38AF4CCD2` | `0x07A29A0A086Bc8262a9320db93E603eE13D57962` |

SpotPool addresses are listed under [Contract Specifications](/developers/contracts/contract-specifications.md).

## Granting approval

There are two grant scopes plus a per-pool denial:

* **Global** — `setOperatorApprovalGlobal(operator, selectors, true)` covers **every pool registered in the `SpotPoolRegistry`**, including pools registered in the future. One call, all official pools.
* **Per-pool** — `setOperatorApprovalForPool(pool, operator, selectors, true)` approves a single pool (it need not be in the registry).
* **Per-pool denial** — `setOperatorDenialForPool(pool, operator, selectors, true)` is an explicit **kill switch** that trumps both approval paths. Use it to carve one pool out of a broad global grant without revoking the grant.

Resolution rule: `isApproved = NOT perPoolDenied AND (perPoolApproved OR (globalApproved AND poolRegistered))`. Per-pool approval and denial are mutually exclusive — setting one clears the other. Revoke by re-calling the setter with `false`; revocation is immediate and does not affect orders already resting.

{% hint style="warning" %}
**A global grant auto-extends to future pools.** The pool universe is curated by the protocol admin; if a new pool is registered, your global approval covers it too. If that is not acceptable, use per-pool approvals (and per-pool denials) for tighter scoping.
{% endhint %}

### Example (cast)

```bash
export OP_REGISTRY=0xE7a190736B6024a4DbafadC04E283075877005ce   # mainnet
export OPERATOR=0x...                                           # the key/contract you are approving
export RPC=https://api.infra.mainnet.somnia.network/

# Approve placing only, across every official pool:
cast send $OP_REGISTRY "setOperatorApprovalGlobal(address,bytes4[],bool)" \
  $OPERATOR "[0x80054449]" true --rpc-url $RPC --private-key $FUND_KEY

# Full order management (place + cancel + reduce):
cast send $OP_REGISTRY "setOperatorApprovalGlobal(address,bytes4[],bool)" \
  $OPERATOR "[0x80054449,0xe37b444b,0x364c2587]" true --rpc-url $RPC --private-key $FUND_KEY
```

Verify the exact yes/no a pool enforces inside `placeOrderFor`:

```bash
cast call $POOL "isOperatorAuthorized(address,address,bytes4)(bool)" \
  $OWNER $OPERATOR 0x80054449 --rpc-url $RPC
```

## Funds and custody

Operators decouple *order management* from *fund custody*:

* Under the default [auto-pull / auto-deliver](/developers/contracts/functions.md#auto-pull-and-auto-deliver) flow, an operator's `placeOrderFor` pulls the owner's input from the **owner's wallet** and delivers fills back to it. The owner sets the pool's ERC-20 allowance (or the order uses native input); the operator funds nothing.
* For a cold-fund / hot-operator split, the owner opts into [manual vault mode](/developers/contracts/functions.md#setmanualvaultmode) and pre-funds the pool vault. The operator then trades against that vault balance; proceeds credit the owner's vault, withdrawable only by the owner.

Either way the operator key can never move funds out — it can only open, cancel, and reduce orders that belong to the owner.

## Related

* [SpotRouter](/developers/contracts/spot-router.md) — the multi-hop swap router; a user approves it as an operator (`placeOrderFor`) once, then swaps.
* [Functions](/developers/contracts/functions.md) — the `placeOrderFor` / `cancelOrderFor` / `reduceOrderFor` reference.
* [`dex-operator-trading`](https://github.com/somnia-chain/somnia-skills) — a self-contained agent skill with the full split-key integration recipe.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.dreamdex.io/trading/readme-1/operators.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
