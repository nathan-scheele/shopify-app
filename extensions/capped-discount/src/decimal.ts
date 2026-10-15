// Exact decimal arithmetic for money. Function input carries Decimals as
// strings ("0.92359"); floats round values like 46.1795 or 1.005 the wrong way.

/** value = units / 10^scale */
export type Decimal = { units: bigint; scale: number };

const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/** Parses a non-negative decimal string or number; null if it isn't one. */
export function parseDecimal(value: string | number): Decimal | null {
  const match = DECIMAL.exec(String(value));
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  return { units: BigInt(whole + fraction), scale: fraction.length };
}

export function multiply(a: Decimal, b: Decimal): Decimal {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

/** Rounds to a whole number of minor units, e.g. cents when `digits` is 2. */
export function toMinorUnits(
  value: Decimal,
  digits: number,
  rounding: 'down' | 'halfUp',
): bigint {
  const shift = value.scale - digits;
  if (shift <= 0) return value.units * 10n ** BigInt(-shift);

  const divisor = 10n ** BigInt(shift);
  const quotient = value.units / divisor;
  if (rounding === 'down') return quotient;
  return (value.units % divisor) * 2n >= divisor ? quotient + 1n : quotient;
}

/** Formats minor units as a Decimal string, e.g. 4617n, 2 → "46.17". */
export function formatMinorUnits(units: bigint, digits: number): string {
  if (digits === 0) return units.toString();
  const padded = units.toString().padStart(digits + 1, '0');
  return `${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
}
