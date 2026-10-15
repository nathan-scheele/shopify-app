import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';
import {
  formatMinorUnits,
  multiply,
  parseDecimal,
  toMinorUnits,
  type Decimal,
} from './decimal';
import { parseConfig } from './config';

const ONE_PERCENT: Decimal = { units: 1n, scale: 2 };

// ISO 4217 currencies with no minor unit. Every other currency is rounded to
// cents (which is also a valid amount in three-decimal currencies).
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.discount.discountClasses.includes(DiscountClass.Order)) {
    return { operations: [] };
  }
  const config = parseConfig(input.discount.metafield?.jsonValue);
  if (!config) return { operations: [] };
  const { amount, currencyCode } = input.cart.cost.subtotalAmount;
  const subtotal = parseDecimal(amount);
  const rate = parseDecimal(input.presentmentCurrencyRate);
  if (!subtotal || !rate) return { operations: [] };
  const minorUnitDigits = ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2;

  const percentageAmount = toMinorUnits(
    multiply(multiply(subtotal, config.percentage), ONE_PERCENT),
    minorUnitDigits,
    'halfUp',
  );
  // Rounded down so the Capped Discount never takes off more than the Cap.
  const convertedCap = toMinorUnits(multiply(config.cap, rate), minorUnitDigits, 'down');
  const discount = percentageAmount < convertedCap ? percentageAmount : convertedCap;
  if (discount === 0n) return { operations: [] };

  // "12.5", "33.33", "20"
  const percentageText = formatMinorUnits(toMinorUnits(config.percentage, 2, 'halfUp'), 2)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
  // "46.17", "49.90", "50"
  const capText = formatMinorUnits(convertedCap, minorUnitDigits).replace(/\.0+$/, '');

  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates: [
            {
              message: `${percentageText}% off, up to ${capText} ${currencyCode}`,
              targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
              value: { fixedAmount: { amount: formatMinorUnits(discount, minorUnitDigits) } },
            },
          ],
          selectionStrategy: OrderDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}
