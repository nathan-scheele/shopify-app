import { parseDecimal, type Decimal } from './decimal';

/**
 * The JSON stored in the discount's `$app.function-configuration` metafield.
 * See docs/capped-discount.md for the contract.
 */
export type CappedDiscountConfig = {
  /** Percentage off the Order Subtotal: 0 < percentage ≤ 100. */
  percentage: number;
  /** Cap in the shop's currency: cap > 0. */
  cap: number;
};

export type ParsedConfig = { percentage: Decimal; cap: Decimal };

/** The config, or null when it's missing or invalid. */
export function parseConfig(jsonValue: unknown): ParsedConfig | null {
  if (typeof jsonValue !== 'object' || jsonValue === null) return null;
  const { percentage, cap } = jsonValue as Record<string, unknown>;
  if (typeof percentage !== 'number' || percentage <= 0 || percentage > 100) return null;
  if (typeof cap !== 'number' || cap <= 0) return null;

  // Rejects numbers JavaScript prints in exponent form (e.g. 0.0000001 → "1e-7").
  const percentageDecimal = parseDecimal(percentage);
  const capDecimal = parseDecimal(cap);
  if (!percentageDecimal || !capDecimal) return null;

  return { percentage: percentageDecimal, cap: capDecimal };
}
