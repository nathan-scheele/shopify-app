import { describe, expect, test } from 'vitest';
import { cartLinesDiscountsGenerateRun } from '../src';
import type { CartInput } from '../generated/api';

// Function input JSON as Shopify sends it: Decimals are strings, the metafield's
// jsonValue is already parsed.
function input({
  subtotal = '100.00',
  currencyCode = 'USD',
  rate = '1.0',
  config = { percentage: 20, cap: 50 } as unknown,
  discountClasses = ['ORDER'],
}: {
  subtotal?: string;
  currencyCode?: string;
  rate?: string;
  /** The metafield's jsonValue; `null` means the discount has no metafield. */
  config?: unknown;
  discountClasses?: string[];
} = {}) {
  return {
    cart: { cost: { subtotalAmount: { amount: subtotal, currencyCode } } },
    discount: {
      discountClasses,
      metafield: config === null ? null : { jsonValue: config },
    },
    presentmentCurrencyRate: rate,
  } as CartInput;
}

const NO_DISCOUNT = { operations: [] };

function cappedDiscount(amount: string, message: string) {
  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates: [
            {
              message,
              targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
              value: { fixedAmount: { amount } },
            },
          ],
          selectionStrategy: 'FIRST',
        },
      },
    ],
  };
}

describe('Capped Discount', () => {
  test('takes the full percentage off when it is below the Cap', () => {
    expect(cartLinesDiscountsGenerateRun(input({ subtotal: '100.00' }))).toEqual(
      cappedDiscount('20.00', '20% off, up to 50 USD'),
    );
  });

  test('takes exactly the Cap off when the percentage would be more', () => {
    expect(cartLinesDiscountsGenerateRun(input({ subtotal: '400.00' }))).toEqual(
      cappedDiscount('50.00', '20% off, up to 50 USD'),
    );
  });

  test('takes the Cap off when the percentage lands exactly on it', () => {
    expect(cartLinesDiscountsGenerateRun(input({ subtotal: '250.00' }))).toEqual(
      cappedDiscount('50.00', '20% off, up to 50 USD'),
    );
  });

  test('rounds the percentage amount to the nearest cent', () => {
    // 10% × 10.05 = 1.005
    expect(
      cartLinesDiscountsGenerateRun(
        input({ subtotal: '10.05', config: { percentage: 10, cap: 50 } }),
      ),
    ).toEqual(cappedDiscount('1.01', '10% off, up to 50 USD'));
  });

  test('message shows a fractional percentage and a Cap with cents as set', () => {
    expect(
      cartLinesDiscountsGenerateRun(
        input({ subtotal: '100.00', config: { percentage: 12.5, cap: 49.9 } }),
      ),
    ).toEqual(cappedDiscount('12.50', '12.5% off, up to 49.90 USD'));
  });

  test('message rounds a long percentage to two decimals', () => {
    const [operation] = cartLinesDiscountsGenerateRun(
      input({ config: { percentage: 100 / 3, cap: 50 } }),
    ).operations;
    expect(operation).toMatchObject({
      orderDiscountsAdd: { candidates: [{ message: '33.33% off, up to 50 USD' }] },
    });
  });

  test('gives no discount when the discount is not an order discount', () => {
    expect(
      cartLinesDiscountsGenerateRun(input({ discountClasses: ['PRODUCT'] })),
    ).toEqual(NO_DISCOUNT);
  });

  test('gives no discount when the Order Subtotal is zero', () => {
    expect(cartLinesDiscountsGenerateRun(input({ subtotal: '0.0' }))).toEqual(
      NO_DISCOUNT,
    );
  });

  test('gives no discount when the discount has no config', () => {
    expect(cartLinesDiscountsGenerateRun(input({ config: null }))).toEqual(
      NO_DISCOUNT,
    );
  });

  test.each([
    ['percentage is 0', { percentage: 0, cap: 50 }],
    ['percentage is negative', { percentage: -5, cap: 50 }],
    ['percentage is over 100', { percentage: 100.5, cap: 50 }],
    ['Cap is 0', { percentage: 20, cap: 0 }],
    ['Cap is negative', { percentage: 20, cap: -10 }],
    ['percentage is a string', { percentage: '20', cap: 50 }],
    ['Cap is a string', { percentage: 20, cap: '50' }],
    ['Cap is missing', { percentage: 20 }],
    ['percentage is missing', { cap: 50 }],
    ['config is not an object', 42],
    ['config is an array', [20, 50]],
    // A metafield that isn't the json type surfaces its raw text as a string.
    ['config is malformed JSON text', '{"percentage": 20, "cap":'],
  ])('gives no discount when the %s', (_, config) => {
    expect(cartLinesDiscountsGenerateRun(input({ config }))).toEqual(NO_DISCOUNT);
  });

  describe('in a checkout currency other than the shop currency', () => {
    test('converts the Cap at the presentment currency rate', () => {
      expect(
        cartLinesDiscountsGenerateRun(
          input({ subtotal: '1000.00', currencyCode: 'EUR', rate: '0.9234' }),
        ),
      ).toEqual(cappedDiscount('46.17', '20% off, up to 46.17 EUR'));
    });

    test('rounds the converted Cap down to the cent, so it is never exceeded', () => {
      // 50 × 0.92359 = 46.1795
      expect(
        cartLinesDiscountsGenerateRun(
          input({ subtotal: '1000.00', currencyCode: 'EUR', rate: '0.92359' }),
        ),
      ).toEqual(cappedDiscount('46.17', '20% off, up to 46.17 EUR'));
    });

    test('works in whole units for a currency without cents', () => {
      // Cap: 50 × 151.237 = 7561.85 → 7561 JPY. Percentage: 20% × 1234 = 246.8 → 247 JPY.
      expect(
        cartLinesDiscountsGenerateRun(
          input({ subtotal: '100000', currencyCode: 'JPY', rate: '151.237' }),
        ),
      ).toEqual(cappedDiscount('7561', '20% off, up to 7561 JPY'));
      expect(
        cartLinesDiscountsGenerateRun(
          input({ subtotal: '1234', currencyCode: 'JPY', rate: '151.237' }),
        ),
      ).toEqual(cappedDiscount('247', '20% off, up to 7561 JPY'));
    });
  });
});
