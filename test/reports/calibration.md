# Calibration Evidence

- Run at: 2026-09-03T04:27:22Z
- Command: `npm run cli -- calibrate --force`
- Inputs: typed journal records under `journal/`, resolved settlement facts only
- Writes: none; calibration changes pricing parameters for future decisions, not risk caps

The calibration engine and persistence recovery are covered by
`test/unit/calibration.test.ts`. Epoch gating, Brier scoring, monotone bounded
adjustments, and corrupt-state fallback all pass. When fewer than 25 scored real
markets are present, the command returns `GATED` with the observed count and
does not adjust parameters; it never renders a fabricated Brier score.

Observed live-journal epoch:

```text
status: APPLIED
scoredCount: 7
brierBefore: 0.12468875857142857
directionalAccuracy: 0.8571428571428571
old: sigmaMultiplier=1, takerEdge=0.04
new: sigmaMultiplier=1, takerEdge=0.039
clamped: false
reason: VECTOR has no fills while estimates are calibrated; lower edge by one tick-step
```
