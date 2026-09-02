/**
 * Fair value for a DreamDEX event contract: P(close ≥ strike) under a
 * driftless GBM for the remaining window, computed from REAL inputs only —
 * the oracle feed's live spot, the on-chain opening price (strike), realized
 * volatility observed from the feed, and time remaining.
 *
 * This is a pure function: unit tests assert its exact shape (Φ at normal
 * argument, step behavior at t→0, band widening with vol). It is an ESTIMATE —
 * the journal and the UI label it "AI ESTIMATE" and never as an on-chain fact.
 */

/** Standard normal CDF via erf approximation (Abramowitz–Stegun 7.1.26, |ε|<1.5e-7). */
export function normCdf(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

export interface FairValueInput {
  /** Live spot of the underlying (human units, e.g. BTC in USD). */
  spot: number;
  /** The window's opening price (the strike) — an on-chain fact. */
  strike: number;
  /** Realized volatility of the underlying, per √second. */
  sigmaPerSqrtSec: number;
  /** Seconds remaining until the window closes. */
  secondsLeft: number;
}

export interface FairValue {
  /** Estimated P(close ≥ strike). AI ESTIMATE, not a fact. */
  p: number;
  /** Distance of spot from strike, in units of sigma*sqrt(t). */
  d: number;
  /** One-sigma probability band around p (uncertainty from the vol estimate). */
  band: [number, number];
  /** The model's one-sigma expected move of spot over the remaining window (human units). */
  expectedMove: number;
}

/**
 * Compute fair value. Edge cases are explicit:
 * - secondsLeft ≤ 0  → the window outcome is determined: step at spot vs strike.
 * - sigma = 0        → degenerate diffusion: step.
 * - strike ≤ 0 / non-finite inputs → NaN p (caller treats as UNAVAILABLE).
 */
export function fairValue(input: FairValueInput): FairValue {
  const { spot, strike, sigmaPerSqrtSec, secondsLeft } = input;
  if (
    !Number.isFinite(spot) ||
    !Number.isFinite(strike) ||
    !Number.isFinite(sigmaPerSqrtSec) ||
    sigmaPerSqrtSec < 0 ||
    strike <= 0 ||
    spot <= 0
  ) {
    return { p: NaN, d: NaN, band: [NaN, NaN], expectedMove: NaN };
  }
  const t = Math.max(0, secondsLeft);
  const sigmaT = sigmaPerSqrtSec * Math.sqrt(t);
  const expectedMove = sigmaT * spot;
  let p: number;
  let d: number;
  if (t === 0 || sigmaPerSqrtSec === 0) {
    d = spot > strike ? Infinity : spot < strike ? -Infinity : 0;
    p = spot >= strike ? 1 : 0;
    if (sigmaPerSqrtSec === 0 && t > 0 && spot === strike) p = 0.5; // degenerate: no info
  } else {
    d = Math.log(spot / strike) / sigmaT;
    p = normCdf(d);
  }
  // Band: shift the strike by ±expectedMove — the range p would take if the
  // vol estimate is off by one sigma of realized-vs-true vol.
  const pHi = strike - expectedMove > 0 ? normCdf(Math.log(spot / (strike - expectedMove)) / (sigmaT || 1e-9)) : 1;
  const pLo = strike + expectedMove > 0 ? normCdf(Math.log(spot / (strike + expectedMove)) / (sigmaT || 1e-9)) : 0;
  const band: [number, number] = [Math.max(0, Math.min(1, pLo)), Math.max(0, Math.min(1, pHi))];
  return { p, d, band, expectedMove };
}

/**
 * Realized volatility per √second from a series of real price observations.
 * Uses log-return standard deviation with the observation interval derived
 * from the timestamps themselves — no assumed cadence.
 */
export function realizedVolPerSqrtSec(
  ticks: Array<{ price: number; ts: number }>,
): number {
  if (ticks.length < 3) return NaN;
  const sorted = [...ticks].sort((a, b) => a.ts - b.ts);
  const rets: number[] = [];
  let dtSum = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dt = (sorted[i].ts - sorted[i - 1].ts) / 1000;
    if (dt <= 0 || sorted[i - 1].price <= 0) continue;
    rets.push(Math.log(sorted[i].price / sorted[i - 1].price));
    dtSum += dt;
  }
  if (rets.length < 2 || dtSum <= 0) return NaN;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  // variance is per average-interval; scale to per second, then take √
  const avgDt = dtSum / rets.length;
  const perSecond = variance / avgDt;
  return Math.sqrt(perSecond);
}
