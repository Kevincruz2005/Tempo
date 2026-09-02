/**
 * Appraiser — maintains per-asset spot history from the official price feed
 * and computes fair value for each managed window. History is seeded from the
 * feed's own endpoint (fetchPriceHistory) and then extended by live watch
 * ticks. All inputs are real; vol estimation is deterministic.
 */
import { fairValue, realizedVolPerSqrtSec, type FairValue } from "@tempo/core";

export interface AppraisedWindow {
  fv: FairValue;
  sigma: number;
  samples: number;
}

export class Appraiser {
  private history: Record<string, Array<{ price: number; ts: number }>> = {};
  private seeded = new Set<string>();

  constructor(
    private readonly fetchHistory: (asset: string) => Promise<Array<{ price: number; ts: number }>>,
    private readonly minSamples = 6,
  ) {}

  /** Seed history once per asset from the feed endpoint. */
  async seed(asset: string): Promise<void> {
    if (this.seeded.has(asset)) return;
    try {
      const hist = await this.fetchHistory(asset);
      if (hist.length > 0) {
        this.history[asset] = hist.slice(-240);
        this.seeded.add(asset);
      }
    } catch {
      // honest: no history yet; live ticks will build it
      this.seeded.add(asset);
    }
  }

  /** Record a live tick from the feed watch. */
  observe(asset: string, price: number, tsMs: number): void {
    if (!Number.isFinite(price) || price <= 0) return;
    const arr = (this.history[asset] ??= []);
    const last = arr[arr.length - 1];
    if (last && last.ts === tsMs && last.price === price) return;
    arr.push({ price, ts: tsMs });
    if (arr.length > 600) arr.splice(0, 300);
  }

  latest(asset: string): { price: number; ts: number } | undefined {
    return this.history[asset]?.[this.history[asset].length - 1];
  }

  /** Realized vol over the trailing window; NaN until enough samples. */
  sigma(asset: string): { sigma: number; samples: number } {
    const arr = this.history[asset] ?? [];
    const recent = arr.slice(-120);
    const sigma = realizedVolPerSqrtSec(recent);
    return { sigma, samples: recent.length };
  }

  /** Fair value for one window; unavailable until enough real feed samples exist. */
  appraise(asset: string, spot: number, strike: number, secondsLeft: number): AppraisedWindow {
    const { sigma, samples } = this.sigma(asset);
    const use = Number.isFinite(sigma) && samples >= this.minSamples ? sigma : NaN;
    const fv = fairValue({ spot, strike, sigmaPerSqrtSec: use, secondsLeft });
    return { fv, sigma: use, samples };
  }
}
