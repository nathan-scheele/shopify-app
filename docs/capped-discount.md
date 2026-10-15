# Capped Discount

A Capped Discount takes min(percentage × Order Subtotal, Cap) off the order. The calculation lives in the discount Function at `extensions/capped-discount`. Everything else (buyer rules, dates, combinations, usage limits) uses Shopify's standard discount fields, so the Function has no eligibility logic ([ADR 0002](adr/0002-capped-discount-function-has-no-eligibility-logic.md)).

## Config metafield (the contract)

The Function reads the config from an app-owned JSON metafield on the discount. The Capped Discount settings extension writes it, the seed script creates it, and the eligibility view reads it.

| | |
|---|---|
| Owner | the discount (`DiscountNode`, e.g. `gid://shopify/DiscountCodeNode/123`) |
| Namespace | `$app` |
| Key | `function-configuration` |
| Type | `json` |
| Definition | `[discount.metafields.app.function-configuration]` in `shopify.app.toml`, admin access `merchant_read` |

```json
{ "percentage": 20, "cap": 50 }
```

- `percentage`: a JSON number, 0 < percentage ≤ 100. Fractions are allowed (`12.5`). The calculation uses the full value. The message rounds it to two decimals, so settings should limit input to two decimals.
- `cap`: a JSON number greater than 0, in the **shop's currency**, e.g. `49.99`.
- Other keys are ignored.

The Function gives **no discount** when the metafield is missing, isn't a JSON object, or breaks any of the rules above. That includes numbers sent as strings (`"20"`) and numbers tiny or huge enough that JavaScript prints them in exponent form (`0.0000001` → `1e-7`). Settings should reject these before saving (user story 11).

`$app` resolves to the namespace of the app making the call, so only this app can write the config. That covers the settings extension, App Home's direct API access, and the CLI's GraphiQL during `shopify app dev`. A seed script that authenticates as a different app would write into that app's namespace, where the Function never looks.

Read it (App Home, eligibility view):

```graphql
query CappedDiscountConfig($id: ID!) {
  discountNode(id: $id) {
    id
    config: metafield(namespace: "$app", key: "function-configuration") {
      jsonValue
    }
  }
}
```

Write it (settings, edits):

```graphql
mutation SetCappedDiscountConfig($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key jsonValue }
    userErrors { field message }
  }
}
```

```json
{
  "metafields": [
    {
      "ownerId": "gid://shopify/DiscountCodeNode/123",
      "namespace": "$app",
      "key": "function-configuration",
      "type": "json",
      "value": "{\"percentage\":20,\"cap\":50}"
    }
  ]
}
```

## Calculation

The Function uses the `cart.lines.discounts.generate.run` target. It only acts when the discount's classes include `ORDER`.

1. **Order Subtotal**: `cart.cost.subtotalAmount`, in the checkout (presentment) currency.
2. **Percentage amount**: percentage × Order Subtotal, rounded half-up to the currency's minor unit.
3. **Converted Cap**: Cap × `presentmentCurrencyRate`, rounded **down** to the minor unit, so the discount never exceeds the Cap. `presentmentCurrencyRate` is a top-level field of the Function input (a Decimal string). It is the exchange rate from the shop's currency to the checkout currency.
4. **Discount**: the smaller of the two, emitted as one `orderDiscountsAdd` candidate with a `fixedAmount` value that targets `orderSubtotal`. If the amount is zero (e.g. an empty cart), there is no discount.

The maths is exact decimal arithmetic on BigInts, not floats (`src/decimal.ts`). Minor units come from ISO 4217: currencies with no minor unit (JPY, KRW, VND, CLP, ISK and others) use whole units, and every other currency uses cents. A three-decimal currency such as KWD is rounded to two decimals, which is still a valid amount.

The Cap applies only to the Capped Discount's own amount. Shopify applies any combined discounts separately (user story 16).

## Message

```
<percentage>% off, up to <converted Cap> <checkout currency code>
```

- `20% off, up to 50 USD`: whole amounts drop `.00`
- `12.5% off, up to 49.90 USD`: the percentage shows at most two decimals
- `20% off, up to 46.17 EUR`: a USD 50 Cap at rate 0.92359
- `20% off, up to 7561 JPY`

The message shows the converted Cap in the shopper's currency, because that is the amount that actually limits their discount. It uses the ISO code because Functions run without `Intl`, so currency symbols would need a hand-written table, and `$` alone is ambiguous. Checkout shows it in capitals ("10% OFF, UP TO 25 USD"). For code discounts, Shopify shows the code instead of this message.

## Creating a Capped Discount through the Admin API

Use this until the settings extension (#4) lands. Run it as this app against `very-best-dev-store`: save the mutation to a file, then run `shopify app execute --store very-best-dev-store.myshopify.com --version 2026-10 --query-file <file>`. The GraphiQL that `shopify app dev` opens (press `g`) also works. Both mutations need `write_discounts`. `functionHandle` is the extension handle from `extensions/capped-discount/shopify.extension.toml`.

Code discount:

```graphql
mutation {
  discountCodeAppCreate(
    codeAppDiscount: {
      title: "Capped 20% (code)"
      code: "CAPPED20"
      functionHandle: "capped-discount"
      discountClasses: [ORDER]
      startsAt: "2026-10-14T00:00:00-04:00"
      combinesWith: { orderDiscounts: false, productDiscounts: true, shippingDiscounts: true }
      metafields: [
        {
          namespace: "$app"
          key: "function-configuration"
          type: "json"
          value: "{\"percentage\":20,\"cap\":50}"
        }
      ]
    }
  ) {
    codeAppDiscount { discountId status }
    userErrors { field message }
  }
}
```

Automatic discount:

```graphql
mutation {
  discountAutomaticAppCreate(
    automaticAppDiscount: {
      title: "Capped 10% up to $25 (automatic)"
      functionHandle: "capped-discount"
      discountClasses: [ORDER]
      startsAt: "2026-10-14T00:00:00-04:00"
      combinesWith: { orderDiscounts: false, productDiscounts: true, shippingDiscounts: true }
      metafields: [
        {
          namespace: "$app"
          key: "function-configuration"
          type: "json"
          value: "{\"percentage\":10,\"cap\":25}"
        }
      ]
    }
  ) {
    automaticAppDiscount { discountId status }
    userErrors { field message }
  }
}
```

The dev store's timezone is America/New_York, hence the `-04:00` offset. The automatic discount uses a different config from the code discount so the two are easy to tell apart. They don't combine with each other (`orderDiscounts: false`), so when both apply, Shopify keeps the larger one.

### Checked at checkout (2026-10-14, app version very-best-app-5)

| Discount | Cart | Shown at checkout |
|---|---|---|
| `CAPPED20` (20%, Cap $50) | Ski Wax $24.95 | Order discount CAPPED20 − $4.99 |
| `CAPPED20` | Complete Snowboard $699.95 | Order discount CAPPED20 − $50.00 |
| Automatic (10%, Cap $25) | Ski Wax $49.95 | 10% OFF, UP TO 25 USD − $5.00 (4.995 rounded half-up) |
| Automatic | Complete Snowboard $699.95 | 10% OFF, UP TO 25 USD − $25.00 |

## Tests

`pnpm --filter capped-discount test` runs two suites at the Function input → output operations boundary:

- `tests/cart_lines_discounts_generate_run.test.ts`: the full set of behaviour cases, run directly against the TypeScript export.
- `tests/default.test.js` (from the CLI template): builds the Wasm and runs each `tests/fixtures/*.json` through Shopify's function runner. It also validates the input query, the fixture input and the expected output against `schema.graphql`.
