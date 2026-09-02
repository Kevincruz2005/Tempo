import { describe, expect, it } from "vitest";
import { AgentLedger } from "@tempo/core";

describe("AgentLedger", () => {
  it("derives realized settlement P&L from fills", () => {
    const ledger = new AgentLedger();
    ledger.applyFill("window", { kind: "BUY_UP", price: 0.4, size: 10 });
    expect(ledger.settle("window", "UP_WON")).toBeCloseTo(6);
    expect(ledger.snapshot().netCashOut).toBeCloseTo(-6);
  });

  it("pays both held outcomes at half on a void", () => {
    const ledger = new AgentLedger();
    ledger.applyFill("window", { kind: "BUY_UP", price: 0.4, size: 2 });
    ledger.applyFill("window", { kind: "BUY_DOWN", price: 0.4, size: 2 });
    expect(ledger.settle("window", "VOID")).toBeCloseTo(0.4);
  });
});
