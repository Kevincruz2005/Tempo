# TEMPO 2.5-Minute Demo Script

Every spoken number must be refreshed from `/api/stats`, `/api/state`, or a dated evidence report before recording.

## 0:00–0:20 — The dead birth

Open the Evidence stream or Markets settlement snapshot and select a finalized zero-trade window.

> DreamDEX creates a new prediction market every minute. This one lived its entire life and closed with zero trades: no opening price discovery and no usable book. TEMPO is not another bot trading an existing market. It is the missing opening auction.

## 0:20–0:40 — The Anchoring

Open Venue Pulse, select a newborn window, and show the center book and fair-value panel.

> TEMPO detects the birth from the live chain path. Before a book exists, The Anchoring prices the outcome from the official spot feed against the on-chain opening price, realized volatility, and time remaining. GENESIS turns that estimate into Liquidity Genesis: a bounded two-sided quote.

## 0:40–1:10 — Two policies, one boundary

Open Agents & Risk, then inspect GENESIS and VECTOR activity.

> GENESIS supplies the opening book. VECTOR independently evaluates the touch and only takes when its own estimate sees enough edge. They use separate keys and separate policies, but every action crosses the same deterministic RiskEngine before signing. Disagreement is real; risk remains centralized and inspectable.

## 1:10–1:40 — Verifiable Trading Intelligence

Point to the intelligence bar, then open History.

> Every estimate is journaled before action and scored after settlement against on-chain truth. In the September 5 evidence snapshot, 18 markets were scorable: Brier 0.0561 and 94.4 percent directional accuracy. A 0.25 Brier score is coin-flip confidence. TEMPO grades its intelligence instead of asking you to trust it.

## 1:40–2:10 — The Roll and proof

Show a lock or settlement, an oracle audit link, a claim receipt, and the successor lifecycle.

> The same firm manages the endgame, observes oracle resolution, redeems the winning side or both sides on a void, and rolls capital into the successor window. This is The Roll: disconnected ephemeral markets become one continuous service. Run `tempo verify` and each journaled hash can be checked against Somnia.

## 2:10–2:30 — Participation and close

Open Connect Wallet and stop at the pre-sign review. If and only if a verified attributed external fill exists, show it now.

> Any wallet holder can inspect the book and review an IOC order with market, side, size, price, cost, expiry, chain status, and RiskEngine verdict before signing. TEMPO is Liquidity Genesis for rolling markets: the venue's missing market-structure function, run by machines, measurable from birth to settlement.

Do not claim external adoption unless the tape includes an `EXTERNAL` counterparty and its transaction is independently verified.
