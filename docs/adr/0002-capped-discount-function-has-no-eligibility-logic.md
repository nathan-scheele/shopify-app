# The Capped Discount Function has no eligibility logic

The Capped Discount Function only calculates the discount amount: min(percentage × Order Subtotal, Cap). Who can use the discount, its dates, combinations and usage limits all use Shopify's standard discount fields. This keeps our own discounts fully readable by the eligibility view. Adding customer rules inside the Function (e.g. tag checks) would make our own discounts Undeterminable, so don't.
