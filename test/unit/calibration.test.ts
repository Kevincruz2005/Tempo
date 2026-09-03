import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CalibrationEngine, CalibrationStore, scoreCalibrationRecords, type JournalRecord } from "@tempo/core";

function records(count: number, fairP = 0.99): JournalRecord[] {
  const out: JournalRecord[] = [];
  for (let i = 0; i < count; i++) {
    const marketId = `0x${i.toString(16).padStart(64, "0")}`;
    out.push({ ts: new Date(1_700_000_000_000 + i * 1000).toISOString(), type: "decision", marketId, data: { fairP, secondsLeft: 30 } });
    out.push({ ts: new Date(1_700_000_000_500 + i * 1000).toISOString(), type: "settlement", marketId, data: { winningOutcome: 1, voided: false } });
  }
  return out;
}

describe("deterministic calibration", () => {
  it("scores synthetic settlement outcomes and gates small epochs", () => {
    const score = scoreCalibrationRecords(records(3, 0.75));
    expect(score.scoredCount).toBe(3);
    expect(score.brier).toBeCloseTo(0.5625);
    const path = join(mkdtempSync(join(tmpdir(), "tempo-calibration-")), "state.json");
    const result = new CalibrationEngine(path).run(records(3), false);
    expect(result.status).toBe("GATED");
    rmSync(path, { force: true });
  });

  it("adjusts once per epoch and clamps both pricing parameters", () => {
    const root = mkdtempSync(join(tmpdir(), "tempo-calibration-"));
    const path = join(root, "journal", "calibration.json");
    const engine = new CalibrationEngine(path, { sigmaMultiplier: 1, takerEdge: 0.04 });
    const result = engine.run(records(25), false, 1_700_000_100_000);
    expect(result.status).toBe("APPLIED");
    expect(result.epoch?.scoredCount).toBe(25);
    expect(result.state.params.sigmaMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(result.state.params.sigmaMultiplier).toBeLessThanOrEqual(2);
    expect(result.state.params.takerEdge).toBeGreaterThanOrEqual(0.02);
    expect(result.state.params.takerEdge).toBeLessThanOrEqual(0.08);
    const gated = engine.run(records(25), false, 1_700_000_200_000);
    expect(gated.epoch?.id).toBe(2);
    rmSync(root, { recursive: true, force: true });
  });

  it("recovers defaults from corrupt state and reports the reason", () => {
    const root = mkdtempSync(join(tmpdir(), "tempo-calibration-"));
    const path = join(root, "state.json");
    mkdirSync(root, { recursive: true });
    writeFileSync(path, "{not-json");
    let reason = "";
    const state = new CalibrationStore(path, { sigmaMultiplier: 1, takerEdge: 0.04 }).load((message) => { reason = message; });
    expect(state.params).toEqual({ sigmaMultiplier: 1, takerEdge: 0.04 });
    expect(reason).toMatch(/Unexpected|JSON|position/i);
    rmSync(root, { recursive: true, force: true });
  });
});

