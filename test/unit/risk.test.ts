import { describe, expect, it } from "vitest";
import { DEFAULT_RISK, RiskEngine } from "@tempo/core";

const order = {
  outcome: "UP" as const,
  price: 0.5,
  size: 10,
  collateral: 5,
  secondsLeft: 120,
  intervalSec: 300,
};

describe("RiskEngine", () => {
  it("allows an order within every cap", () => {
    expect(new RiskEngine(DEFAULT_RISK).check(order, { netInventory: 0, grossInventory: 0, capitalCommitted: 0 })).toEqual({ ok: true });
  });

  it("binds before firm capital is exhausted", () => {
    const verdict = new RiskEngine({ ...DEFAULT_RISK, firmCapitalCap: 8 }).check(order, {
      netInventory: 0,
      grossInventory: 0,
      capitalCommitted: 4,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("firm capital");
  });

  it("rejects maker activity in the expiry gate", () => {
    expect(new RiskEngine(DEFAULT_RISK).check({ ...order, secondsLeft: 10 }, { netInventory: 0, grossInventory: 0, capitalCommitted: 0 }).ok).toBe(false);
  });

  it("enforces open-order and per-window loss caps", () => {
    const engine = new RiskEngine({ ...DEFAULT_RISK, maxOpenOrdersPerWindow: 2, maxLossPerWindow: 10 });
    expect(engine.check(order, { netInventory: 0, grossInventory: 0, capitalCommitted: 0, openOrders: 2 }).ok).toBe(false);
    expect(engine.check(order, { netInventory: 0, grossInventory: 0, capitalCommitted: 0, realizedPnl: -10 }).ok).toBe(false);
  });
});
