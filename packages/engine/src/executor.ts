/**
 * Executor — turns a policy plan into signed SDK writes with receipt checks,
 * typed failure handling, and journaling. The only place in TEMPO that sends
 * transactions (aside from one-shot CLI trades through the same methods).
 */
import {
  TempoExchange,
  TempoError,
  isTempoError,
  type Journal,
  type QuotePlan,
  type TakerPlan,
  type BookParams,
} from "@tempo/core";

export interface ExecutionResult {
  sent: number;
  cancelled: number;
  hashes: string[];
  errors: Array<{ what: string; code: string; message: string }>;
}

export class Executor {
  constructor(
    private readonly exchange: TempoExchange,
    private readonly journal: Journal,
    private readonly agent: string,
    private readonly dryRun: boolean,
  ) {}

  private logErr(res: ExecutionResult, what: string, e: unknown): void {
    const code = isTempoError(e) ? e.code : "ERROR";
    const message = e instanceof Error ? e.message : String(e);
    res.errors.push({ what, code, message });
    this.journal.append({
      type: "error",
      agent: this.agent,
      data: { what, code, message },
    });
  }

  /** Execute a maker plan: cancel stale, post fresh (post-only). */
  async executeQuotePlan(
    m: { marketId: string; upSymbol: string; downSymbol: string; symbol: string; pool?: string },
    plan: QuotePlan,
    params: BookParams,
    decisionId?: string,
  ): Promise<ExecutionResult> {
    const res: ExecutionResult = { sent: 0, cancelled: 0, hashes: [], errors: [] };
    for (const c of plan.cancels) {
      this.journal.append({
        type: "order-cancelled",
        agent: this.agent,
        marketId: m.marketId,
        decisionId,
        contractAddress: m.pool,
        symbol: c.symbol,
        data: { orderId: c.id, reason: "requote", dryRun: this.dryRun },
      });
      if (this.dryRun) {
        res.cancelled++;
        continue;
      }
      try {
        await this.exchange.cancel(c.id, c.symbol);
        res.cancelled++;
      } catch (e) {
        this.logErr(res, `cancel ${c.id}`, e);
      }
    }
    for (const o of plan.orders) {
      const symbol = o.kind === "BUY_UP" || o.kind === "SELL_UP" ? m.upSymbol : m.downSymbol;
      const side = o.kind === "BUY_UP" || o.kind === "BUY_DOWN" ? "buy" : "sell";
      // Grid discipline (venue rejects off-grid values): snap to tick/lot here
      // as a belt-and-braces on top of the policy's own snapping.
      const price = Math.round(o.price / params.tick) * params.tick;
      const size = Math.floor(o.size / params.lot) * params.lot;
      if (size <= 0 || price <= 0 || price >= 1) {
        this.logErr(res, `skip off-grid order ${o.kind}`, new TempoError("PRICE_OFF_GRID", `price ${o.price} size ${o.size}`));
        continue;
      }
      this.journal.append({
        type: "order-sent",
        agent: this.agent,
        marketId: m.marketId,
        decisionId,
        contractAddress: m.pool,
        symbol,
        data: { kind: o.kind, price, size, postOnly: true, dryRun: this.dryRun },
      });
      if (this.dryRun) {
        res.sent++;
        continue;
      }
      try {
        const out = await this.exchange.place(symbol, side, size, price, { postOnly: true });
        res.sent++;
        if (out.hash) res.hashes.push(out.hash);
        this.journal.append({
          type: "order-receipt",
          agent: this.agent,
          marketId: m.marketId,
          decisionId,
          contractAddress: m.pool,
          symbol,
          tx: out.hash,
          data: { kind: o.kind, price, size, orderId: out.orderId, status: out.status ?? "mined" },
        });
      } catch (e) {
        // Post-only that would cross = the book moved into us: a normal
        // requoting event, not a fault. Anything else is a real error.
        const msg = e instanceof Error ? e.message : String(e);
        if (/PostOnlyWouldCross|would cross|cross/i.test(msg)) {
          this.journal.append({
            type: "error",
            agent: this.agent,
            marketId: m.marketId,
            data: { what: "post-only crossed (book moved into us) — will requote", code: "POST_ONLY_CROSS" },
          });
        } else {
          this.logErr(res, `place ${o.kind} ${symbol}`, e);
        }
      }
    }
    return res;
  }

  /** Execute a taker plan: one IOC order, slippage-bounded. */
  async executeTakerPlan(
    m: { marketId: string; upSymbol: string; downSymbol: string; symbol: string; pool?: string },
    plan: TakerPlan,
    params: BookParams,
    decisionId?: string,
  ): Promise<ExecutionResult> {
    const res: ExecutionResult = { sent: 0, cancelled: 0, hashes: [], errors: [] };
    const symbol = plan.kind === "BUY_UP" ? m.upSymbol : m.downSymbol;
    const slippageTicks = 2 * params.tick;
    const price = plan.kind === "BUY_UP" ? plan.price + slippageTicks : plan.price + slippageTicks;
    const size = Math.floor(plan.size / params.lot) * params.lot;
    if (size <= 0) {
      this.logErr(res, "taker size below lot", new TempoError("BELOW_ONE_LOT", `size ${plan.size}`));
      return res;
    }
    this.journal.append({
      type: "order-sent",
      agent: this.agent,
      marketId: m.marketId,
      decisionId,
      contractAddress: m.pool,
      symbol,
      data: { kind: plan.kind, price, size, ioc: true, edge: plan.edgeObserved, reason: plan.reason, dryRun: this.dryRun },
    });
    if (this.dryRun) {
      res.sent++;
      return res;
    }
    try {
      const out = await this.exchange.place(symbol, "buy", size, price, { ioc: true });
      res.sent++;
      if (out.hash) res.hashes.push(out.hash);
      this.journal.append({
        type: "order-receipt",
        agent: this.agent,
        marketId: m.marketId,
        decisionId,
        contractAddress: m.pool,
        symbol,
        tx: out.hash,
        data: { kind: plan.kind, price, size, filled: out.filled, orderId: out.orderId, status: out.status ?? "mined" },
      });
    } catch (e) {
      this.logErr(res, `taker ${plan.kind} ${symbol}`, e);
    }
    return res;
  }
}
