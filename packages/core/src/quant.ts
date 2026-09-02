/** Decimal-aware tick/lot conversion. Bigint results are always raw units. */

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new RangeError(`invalid decimals ${decimals}`);
  }
}

function assertGrid(grid: bigint): void {
  if (grid <= 0n) throw new RangeError(`grid must be positive, got ${grid}`);
}

function rawFromNumber(value: number, decimals: number): bigint {
  assertDecimals(decimals);
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`invalid non-negative value ${value}`);
  const fixed = value.toFixed(decimals);
  const [whole, fraction = ""] = fixed.split(".");
  const scale = 10n ** BigInt(decimals);
  let raw = BigInt(whole) * scale + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  // toFixed rounds; venue quantization must never increase price/size.
  if (Number(fixed) > value && raw > 0n) raw -= 1n;
  return raw;
}

/** Probability to a raw price aligned down to the live tick. */
export function probToTicks(probability: number, tickSize: bigint, decimals: number): bigint {
  assertGrid(tickSize);
  if (!(probability >= 0 && probability <= 1)) throw new RangeError(`probability ${probability} outside [0,1]`);
  const raw = rawFromNumber(probability, decimals);
  return (raw / tickSize) * tickSize;
}

/** Raw tick-aligned price to probability. */
export function ticksToProb(rawPrice: bigint, decimals: number): number {
  assertDecimals(decimals);
  return Number(rawPrice) / Number(10n ** BigInt(decimals));
}

/** Human contract size to raw quantity aligned down to the live lot. */
export function sizeToLots(size: number, lotSize: bigint, decimals: number): bigint {
  assertGrid(lotSize);
  const raw = rawFromNumber(size, decimals);
  return (raw / lotSize) * lotSize;
}

/** Raw lot-aligned quantity to human contract size. */
export function lotsToSize(rawSize: bigint, decimals: number): number {
  assertDecimals(decimals);
  return Number(rawSize) / Number(10n ** BigInt(decimals));
}

export function quantizePrice(probability: number, tickSize: bigint, decimals: number): number {
  return ticksToProb(probToTicks(probability, tickSize, decimals), decimals);
}

export function quantizeSize(size: number, lotSize: bigint, decimals: number): number {
  return lotsToSize(sizeToLots(size, lotSize, decimals), decimals);
}

/** Clamp to the first/last valid probability tick strictly inside (0,1). */
export function clampProbToTicks(
  probability: number,
  tickSize: bigint,
  decimals: number,
): { ticks: bigint; clamped: boolean } {
  assertGrid(tickSize);
  const one = 10n ** BigInt(decimals);
  const max = one - tickSize;
  const bounded = Math.max(0, Math.min(1, probability));
  const candidate = probToTicks(bounded, tickSize, decimals);
  const ticks = candidate < tickSize ? tickSize : candidate > max ? max : candidate;
  return { ticks, clamped: ticks !== candidate || bounded !== probability };
}

export function oneUnit(decimals: number): bigint {
  assertDecimals(decimals);
  return 10n ** BigInt(decimals);
}
