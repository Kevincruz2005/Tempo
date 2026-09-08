/**
 * Firm report — deterministic aggregation of the journal into a markdown
 * report. Every number is computed from real journal records; nothing is
 * estimated here. The optional AI narrative (composed elsewhere) receives
 * ONLY these stats and is labeled as generated text.
 *
 * The interesting analytic: the Brier score of TEMPO's own fair-value
 * estimates against actual settlement outcomes — a real measure of estimate
 * quality computed from what the appraiser believed and what the chain
 * settled. Voided markets are excluded (no directional truth).
 */
import type { Journal, JournalRecord } from "./journal.js";

export interface ReportStats {
  window: { since: string; until: string };
  runs: { startups: number; shutdowns: number; uptimeMs: number; dryRunShares: { dry: number; live: number } };
  markets: { births: number; byAsset: Record<string, number> };
  decisions: { total: number; byAgent: Record<string, number>; withFairValue: number };
  execution: {
    orderSends: { real: number; dry: number };
    receipts: number;
    uniqueTxHashes: string[];
    cancels: number;
    fills: { count: number; quoteVolume: number; byAgent: Record<string, number>; byKind: Record<string, number> };
    claims: { count: number; txs: string[] };
  };
  estimateQuality: {
    scoredMarkets: number;
    brier: number | null;
    directionalAccuracy: number | null;
    note: string;
  };
  risk: { rejects: number; byCode: Record<string, number>; topReasons: Array<{ reason: string; count: number }> };
  errors: { count: number; byWhat: Record<string, number> };
}

export interface ReportAccumulator {
  add(record: JournalRecord): void;
  snapshot(until?: string): ReportStats;
}

/**
 * Incrementally aggregate journal records without retaining the full journal.
 * This keeps the live dashboard bounded even after months of operation.
 */
export function createReportAccumulator(since: string, initialUntil: string): ReportAccumulator {
  const stats: ReportStats = {
    window: { since, until: initialUntil },
    runs: { startups: 0, shutdowns: 0, uptimeMs: 0, dryRunShares: { dry: 0, live: 0 } },
    markets: { births: 0, byAsset: {} },
    decisions: { total: 0, byAgent: {}, withFairValue: 0 },
    execution: {
      orderSends: { real: 0, dry: 0 },
      receipts: 0,
      uniqueTxHashes: [],
      cancels: 0,
      fills: { count: 0, quoteVolume: 0, byAgent: {}, byKind: {} },
      claims: { count: 0, txs: [] },
    },
    estimateQuality: { scoredMarkets: 0, brier: null, directionalAccuracy: null, note: "" },
    risk: { rejects: 0, byCode: {}, topReasons: [] },
    errors: { count: 0, byWhat: {} },
  };

  // --- first pass: everything except estimate quality ---
  const decisionsByMarket = new Map<string, {
    latest: { fairP: number; ts: number };
    nearExpiry?: { fairP: number; secondsLeft: number; ts: number };
  }>();
  const settlements = new Map<string, { voided: boolean; winningOutcome?: number; ts: number }>();
  const reasonCounts: Record<string, number> = {};
  const uniqueTxHashes = new Set<string>();
  const claimTxs = new Set<string>();
  const bump = (rec: Record<string, number>, key: string): void => {
    rec[key] = (rec[key] ?? 0) + 1;
  };
  const add = (r: JournalRecord): void => {
    const d = (r.data ?? {}) as Record<string, unknown>;
    if (r.tx) uniqueTxHashes.add(r.tx);
    switch (r.type) {
      case "startup":
        stats.runs.startups++;
        if (d.dryRun === true) stats.runs.dryRunShares.dry++;
        else stats.runs.dryRunShares.live++;
        break;
      case "shutdown":
        stats.runs.shutdowns++;
        stats.runs.uptimeMs += Number(d.uptimeMs ?? 0);
        break;
      case "market-birth":
        stats.markets.births++;
        bump(stats.markets.byAsset, String(d.asset ?? "?"));
        break;
      case "decision": {
        stats.decisions.total++;
        if (r.agent) bump(stats.decisions.byAgent, r.agent);
        const fairP = d.fairP;
        if (typeof fairP === "number" && Number.isFinite(fairP)) {
          stats.decisions.withFairValue++;
          const marketId = r.marketId ?? "";
          const ts = Date.parse(r.ts);
          const secondsLeft = Number(d.secondsLeft ?? Infinity);
          const previous = decisionsByMarket.get(marketId);
          const latest = !previous || ts >= previous.latest.ts ? { fairP, ts } : previous.latest;
          let nearExpiry = previous?.nearExpiry;
          if (secondsLeft >= 0 && secondsLeft <= 600 && (
            !nearExpiry || secondsLeft < nearExpiry.secondsLeft || (secondsLeft === nearExpiry.secondsLeft && ts < nearExpiry.ts)
          )) {
            nearExpiry = { fairP, secondsLeft, ts };
          }
          decisionsByMarket.set(marketId, { latest, ...(nearExpiry ? { nearExpiry } : {}) });
        }
        break;
      }
      case "order-sent": {
        if (d.dryRun === true) stats.execution.orderSends.dry++;
        else stats.execution.orderSends.real++;
        break;
      }
      case "order-receipt":
        stats.execution.receipts++;
        break;
      case "order-cancelled":
        stats.execution.cancels++;
        break;
      case "fill":
        stats.execution.fills.count++;
        if (Number.isFinite(Number(d.price)) && Number.isFinite(Number(d.size))) {
          stats.execution.fills.quoteVolume += Number(d.price) * Number(d.size);
        }
        if (r.agent) bump(stats.execution.fills.byAgent, r.agent);
        bump(stats.execution.fills.byKind, String(d.kind ?? "?"));
        break;
      case "claim":
        stats.execution.claims.count++;
        if (r.tx) claimTxs.add(r.tx);
        break;
      case "settlement":
        if (r.marketId) {
          const ts = Date.parse(r.ts);
          const previous = settlements.get(r.marketId);
          if (!previous || ts >= previous.ts) {
            settlements.set(r.marketId, {
              voided: d.voided === true,
              winningOutcome: typeof d.winningOutcome === "number" ? d.winningOutcome : undefined,
              ts,
            });
          }
        }
        break;
      case "risk-reject":
        stats.risk.rejects++;
        bump(stats.risk.byCode, String(d.code ?? "?"));
        bump(reasonCounts, String(d.reason ?? "?"));
        break;
      case "error":
        stats.errors.count++;
        bump(stats.errors.byWhat, String(d.what ?? "?"));
        break;
      default:
        break;
    }
  };

  const snapshot = (until = initialUntil): ReportStats => {
    const briers: number[] = [];
    let correct = 0;
    for (const [marketId, settlement] of settlements) {
      if (settlement.voided || settlement.winningOutcome === undefined) continue;
      const decisions = decisionsByMarket.get(marketId);
      if (!decisions) continue;
      const pick = decisions.nearExpiry ?? decisions.latest;
      const outcome = settlement.winningOutcome === 0 ? 1 : 0;
      briers.push((pick.fairP - outcome) ** 2);
      if ((pick.fairP >= 0.5 ? 1 : 0) === outcome) correct++;
    }
    stats.window.until = until;
    stats.execution.uniqueTxHashes = [...uniqueTxHashes];
    stats.execution.claims.txs = [...claimTxs];
    stats.estimateQuality = briers.length > 0
      ? {
          scoredMarkets: briers.length,
          brier: briers.reduce((sum, value) => sum + value, 0) / briers.length,
          directionalAccuracy: correct / briers.length,
          note: "",
        }
      : {
          scoredMarkets: 0,
          brier: null,
          directionalAccuracy: null,
          note: "no settled market carried a pre-expiry fair-value estimate in this window — UNAVAILABLE, not zero",
        };
    stats.risk.topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));
    return stats;
  };

  return { add, snapshot };
}

export function aggregate(records: JournalRecord[], since: string, until: string): ReportStats {
  const accumulator = createReportAccumulator(since, until);
  for (const record of records) accumulator.add(record);
  return accumulator.snapshot();
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

export function renderMarkdown(stats: ReportStats, aiNarrative?: { model: string; text: string }): string {
  const L: string[] = [];
  L.push(`# TEMPO Firm Report`);
  L.push("");
  L.push(`Window: \`${stats.window.since}\` → \`${stats.window.until}\` · all figures computed from the journal (real records only)`);
  L.push("");
  L.push("## Runs");
  L.push(`- Firm starts: **${stats.runs.startups}** (${stats.runs.dryRunShares.live} live-configured, ${stats.runs.dryRunShares.dry} dry-run) · clean shutdowns: ${stats.runs.shutdowns} · accumulated uptime: ${fmt(stats.runs.uptimeMs / 60000, 1)} min`);
  L.push("");
  L.push("## Markets");
  L.push(`- Windows born (observed live): **${stats.markets.births}**${Object.keys(stats.markets.byAsset).length ? " — " + Object.entries(stats.markets.byAsset).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}`);
  L.push(`- Decisions journaled: **${stats.decisions.total}** (with finite fair value: ${stats.decisions.withFairValue})`);
  if (Object.keys(stats.decisions.byAgent).length) {
    L.push(`- By agent: ${Object.entries(stats.decisions.byAgent).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  }
  L.push("");
  L.push("## Execution");
  L.push(`- Order sends: **${stats.execution.orderSends.real} real**, ${stats.execution.orderSends.dry} dry-run · receipts: ${stats.execution.receipts} · cancels: ${stats.execution.cancels}`);
  L.push(`- Unique transaction hashes: **${stats.execution.uniqueTxHashes.length}**${stats.execution.uniqueTxHashes.length ? " — verifiable via \`tempo verify\`" : ""}`);
  L.push(`- Fills: **${stats.execution.fills.count}**${Object.keys(stats.execution.fills.byAgent).length ? " — " + Object.entries(stats.execution.fills.byAgent).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}`);
  L.push(`- Matched quote notional: **${fmt(stats.execution.fills.quoteVolume, 3)}** (sum of journaled fill price × size)`);
  if (Object.keys(stats.execution.fills.byKind).length) {
    L.push(`- Fill kinds: ${Object.entries(stats.execution.fills.byKind).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  }
  L.push(`- Claims: **${stats.execution.claims.count}**${stats.execution.claims.txs.length ? ` (${stats.execution.claims.txs.length} txs)` : ""}`);
  L.push("");
  L.push("## Estimate quality (MODEL ESTIMATE vs settlement fact)");
  if (stats.estimateQuality.brier !== null) {
    L.push(`- Markets scored: **${stats.estimateQuality.scoredMarkets}**`);
    L.push(`- **Brier score: ${fmt(stats.estimateQuality.brier, 4)}** (0 = perfect, 0.25 = coin-flip confidence, 1 = always wrong)`);
    L.push(`- Directional accuracy: **${fmt((stats.estimateQuality.directionalAccuracy ?? 0) * 100, 1)}%**`);
    L.push(`- Method: last fair-value estimate with ≤600 s remaining per resolved market, scored against the on-chain winning outcome; voided markets excluded.`);
  } else {
    L.push(`- ${stats.estimateQuality.note}`);
  }
  L.push("");
  L.push("## Risk engine");
  L.push(`- Rejections: **${stats.risk.rejects}**${Object.keys(stats.risk.byCode).length ? " — " + Object.entries(stats.risk.byCode).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}`);
  for (const t of stats.risk.topReasons) L.push(`  - ${t.count}× ${t.reason}`);
  L.push("");
  L.push("## Errors");
  L.push(`- Total: **${stats.errors.count}**${Object.keys(stats.errors.byWhat).length ? " — " + Object.entries(stats.errors.byWhat).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}`);
  L.push("");
  if (aiNarrative) {
    L.push(`## Executive summary (AI NARRATIVE — generated by ${aiNarrative.model})`);
    L.push("");
    L.push("> The numbers above are journal facts. The text below is AI-generated commentary constrained to those numbers; it introduces no data of its own.");
    L.push("");
    L.push(aiNarrative.text.trim());
    L.push("");
  }
  return L.join("\n");
}

/** Build the full markdown report from a journal. */
export function buildReport(journal: Journal, sinceMs: number, untilMs = Date.now()): string {
  const since = new Date(sinceMs).toISOString();
  const until = new Date(untilMs).toISOString();
  const records = journal.readFiles(sinceMs).filter((r) => Date.parse(r.ts) <= untilMs);
  const stats = aggregate(records, since, until);
  return renderMarkdown(stats);
}
