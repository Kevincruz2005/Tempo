/** Learned, reproducible cold-path calibration from real journal outcomes. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { JournalRecord } from "./journal.js";

export interface CalibrationParams {
  sigmaMultiplier: number;
  takerEdge: number;
}

export interface CalibrationEpoch {
  id: number;
  at: string;
  scoredCount: number;
  brierBefore: number | null;
  brierAfter: number | null;
  directionalAccuracy: number | null;
  oldParams: CalibrationParams;
  newParams: CalibrationParams;
  clamped: boolean;
  reason: string;
  windowFingerprint: string;
  model: { name: "temperature-brier"; version: "1"; temperature: number; windowSize: 30 };
}

export interface CalibrationState {
  version: 1;
  params: CalibrationParams;
  epochs: CalibrationEpoch[];
}

export interface CalibrationScore {
  scoredCount: number;
  brier: number | null;
  directionalAccuracy: number | null;
  vectorFills: number;
  vectorScored: number;
  vectorDirectionalAccuracy: number | null;
  windowFingerprint: string;
  probabilities: number[];
  outcomes: number[];
}

export interface CalibrationResult {
  status: "APPLIED" | "GATED";
  score: CalibrationScore;
  epoch?: CalibrationEpoch;
  state: CalibrationState;
  reason?: string;
}

const clamp = (value: number, base: number): number => Math.max(base * 0.5, Math.min(base * 2, value));

const calibratedProbability = (p: number, temperature: number): number => {
  const bounded = Math.max(1e-6, Math.min(1 - 1e-6, p));
  return 1 / (1 + Math.exp(-Math.log(bounded / (1 - bounded)) / temperature));
};

function fitTemperature(probabilities: readonly number[], outcomes: readonly number[]): { temperature: number; brier: number | null } {
  if (probabilities.length === 0) return { temperature: 1, brier: null };
  let best = { temperature: 1, brier: Number.POSITIVE_INFINITY };
  for (let step = 20; step <= 80; step++) {
    const temperature = step / 40;
    const brier = probabilities.reduce((sum, p, index) => sum + (calibratedProbability(p, temperature) - outcomes[index]) ** 2, 0) / probabilities.length;
    if (brier < best.brier) best = { temperature, brier };
  }
  return best;
}

export function scoreCalibrationRecords(records: readonly JournalRecord[]): CalibrationScore {
  const decisions = new Map<string, Array<{ p: number; secondsLeft: number; ts: number }>>();
  const settlements = new Map<string, { voided: boolean; winner?: number; ts: number }>();
  const vectorDirections = new Map<string, Array<{ up: boolean; ts: number }>>();
  let vectorFills = 0;
  for (const record of records) {
    const data = record.data ?? {};
    if (record.type === "decision" && typeof data.fairP === "number" && Number.isFinite(data.fairP) && record.marketId) {
      const list = decisions.get(record.marketId) ?? [];
      list.push({ p: data.fairP, secondsLeft: Number(data.secondsLeft ?? Number.POSITIVE_INFINITY), ts: Date.parse(record.ts) });
      decisions.set(record.marketId, list);
    } else if (record.type === "settlement" && record.marketId) {
      settlements.set(record.marketId, {
        voided: data.voided === true,
        winner: typeof data.winningOutcome === "number" ? data.winningOutcome : undefined,
        ts: Date.parse(record.ts),
      });
    } else if (record.type === "fill" && record.agent === "VECTOR") {
      vectorFills++;
      if (record.marketId && typeof data.kind === "string") {
        const list = vectorDirections.get(record.marketId) ?? [];
        list.push({ up: data.kind.includes("UP"), ts: Date.parse(record.ts) });
        vectorDirections.set(record.marketId, list);
      }
    }
  }
  const rollingSettlements = [...settlements.entries()]
    .filter(([, settlement]) => !settlement.voided && settlement.winner !== undefined)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, 30);
  const briers: number[] = [];
  const probabilities: number[] = [];
  const outcomes: number[] = [];
  let correct = 0;
  let vectorScored = 0;
  let vectorCorrect = 0;
  const fingerprintRows: string[] = [];
  for (const [marketId, settlement] of rollingSettlements) {
    const list = decisions.get(marketId);
    if (!list?.length) continue;
    const eligible = list.filter((entry) => entry.secondsLeft >= 0 && entry.secondsLeft <= 600);
    const picked = [...(eligible.length ? eligible : list)].sort((a, b) => a.secondsLeft - b.secondsLeft)[0];
    const outcome = settlement.winner === 0 ? 1 : 0;
    briers.push((picked.p - outcome) ** 2);
    probabilities.push(picked.p);
    outcomes.push(outcome);
    fingerprintRows.push(`${marketId}:${picked.p}:${outcome}`);
    if ((picked.p >= 0.5 ? 1 : 0) === outcome) correct++;
    for (const direction of vectorDirections.get(marketId) ?? []) {
      vectorScored++;
      if ((direction.up ? 1 : 0) === outcome) vectorCorrect++;
    }
  }
  return {
    scoredCount: briers.length,
    brier: briers.length ? briers.reduce((sum, value) => sum + value, 0) / briers.length : null,
    directionalAccuracy: briers.length ? correct / briers.length : null,
    vectorFills,
    vectorScored,
    vectorDirectionalAccuracy: vectorScored ? vectorCorrect / vectorScored : null,
    windowFingerprint: createHash("sha256").update(fingerprintRows.sort().join("|")).digest("hex"),
    probabilities,
    outcomes,
  };
}

export class CalibrationStore {
  constructor(private readonly path: string, private readonly defaults: CalibrationParams) {}

  load(onCorrupt?: (message: string) => void): CalibrationState {
    const fallback = (): CalibrationState => ({ version: 1, params: { ...this.defaults }, epochs: [] });
    if (!existsSync(this.path)) return fallback();
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as Partial<CalibrationState>;
      if (parsed.version !== 1 || !parsed.params || !Number.isFinite(parsed.params.sigmaMultiplier) || !Number.isFinite(parsed.params.takerEdge) || !Array.isArray(parsed.epochs)) {
        throw new Error("invalid calibration state shape");
      }
      return {
        version: 1,
        params: {
          sigmaMultiplier: clamp(parsed.params.sigmaMultiplier, this.defaults.sigmaMultiplier),
          takerEdge: clamp(parsed.params.takerEdge, this.defaults.takerEdge),
        },
        epochs: parsed.epochs as CalibrationEpoch[],
      };
    } catch (error) {
      onCorrupt?.(error instanceof Error ? error.message : String(error));
      return fallback();
    }
  }

  save(state: CalibrationState): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  }
}

export class CalibrationEngine {
  private readonly store: CalibrationStore;

  constructor(
    path: string,
    private readonly defaults: CalibrationParams = { sigmaMultiplier: 1, takerEdge: 0.04 },
    private readonly onCorrupt?: (message: string) => void,
  ) {
    this.store = new CalibrationStore(path, defaults);
  }

  run(records: readonly JournalRecord[], force = false, now = Date.now()): CalibrationResult {
    const state = this.store.load(this.onCorrupt);
    const score = scoreCalibrationRecords(records);
    if (!force && score.scoredCount < 25) {
      return { status: "GATED", score, state, reason: `epoch requires 25 scored markets; found ${score.scoredCount}` };
    }
    if (score.scoredCount === 0) {
      return { status: "GATED", score, state, reason: "epoch requires at least one scored market, including with --force" };
    }
    if (state.epochs.some((epoch) => epoch.windowFingerprint === score.windowFingerprint)) {
      return { status: "GATED", score, state, reason: "rolling settlement window was already calibrated" };
    }
    const oldParams = { ...state.params };
    const learned = fitTemperature(score.probabilities, score.outcomes);
    let sigma = oldParams.sigmaMultiplier * learned.temperature;
    let edge = oldParams.takerEdge;
    const reasons: string[] = [`temperature=${learned.temperature.toFixed(3)} fitted by Brier loss over rolling outcomes`];
    if (score.brier !== null && score.directionalAccuracy !== null) {
      if (score.brier > 0.2 && score.directionalAccuracy >= 0.5) {
        sigma *= 1.1;
        reasons.push("Brier is high while directional accuracy holds; widen uncertainty");
      } else if (score.brier > 0.2) {
        sigma *= 1.2;
        reasons.push("Brier is dominated by overconfidence; widen uncertainty");
      } else if (score.brier < 0.1 && score.directionalAccuracy < 0.5) {
        sigma *= 0.9;
        reasons.push("low Brier sample with weak direction; narrow uncertainty cautiously");
      }
      if (score.vectorScored > 0 && (score.vectorDirectionalAccuracy ?? 0) < 0.5) {
        edge += 0.01;
        reasons.push("VECTOR settlement direction is below 50%; raise edge");
      } else if (score.vectorScored >= 5 && (score.vectorDirectionalAccuracy ?? 0) >= 0.7) {
        edge -= 0.001;
        reasons.push("VECTOR settlement direction is at least 70%; lower edge cautiously");
      }
    }
    const newParams = {
      sigmaMultiplier: clamp(sigma, this.defaults.sigmaMultiplier),
      takerEdge: clamp(edge, this.defaults.takerEdge),
    };
    const clamped = newParams.sigmaMultiplier !== sigma || newParams.takerEdge !== edge;
    const epoch: CalibrationEpoch = {
      id: (state.epochs.at(-1)?.id ?? 0) + 1,
      at: new Date(now).toISOString(),
      scoredCount: score.scoredCount,
      brierBefore: score.brier,
      brierAfter: learned.brier,
      directionalAccuracy: score.directionalAccuracy,
      oldParams,
      newParams,
      clamped,
      reason: reasons.join("; ") || "metrics within calibration band; parameters unchanged",
      windowFingerprint: score.windowFingerprint,
      model: { name: "temperature-brier", version: "1", temperature: learned.temperature, windowSize: 30 },
    };
    const next: CalibrationState = { version: 1, params: newParams, epochs: [...state.epochs, epoch].slice(-100) };
    this.store.save(next);
    return { status: "APPLIED", score, epoch, state: next };
  }
}
