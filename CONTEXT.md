# Discounts

The discount part of the app: a percentage order discount with a maximum amount, and a view of which discounts a customer is eligible for.

## Language

### Capped Discount

**Capped Discount**:
A discount that takes a percentage off the Order Subtotal, but never more than its Cap. It can be a code discount or an automatic discount.
_Avoid_: Max discount, limited discount, capped percentage

**Cap**:
The maximum amount a single Capped Discount can take off one order. It is set in the shop's currency and converted to the order's currency at checkout. It counts only that discount's own amount, not other discounts it combines with.
_Avoid_: Maximum, ceiling, limit (too easily confused with usage limits)

**Order Subtotal**:
The cart's merchandise total before shipping and taxes. The Capped Discount's percentage applies to this amount.

### Eligibility

**Eligible**:
A customer is Eligible for a discount when the discount's buyer rules include them: all customers, the customer named directly, or a customer segment they belong to. Cart conditions such as minimum purchase amounts do not affect eligibility; they are shown as Requirements.
_Avoid_: Qualifies, applicable, usable

**Requirement**:
A condition on the order rather than the customer, such as a minimum subtotal, a minimum quantity, or a Market limit ("Canada only"). It is shown alongside a discount but is never used to filter it out.
_Avoid_: Condition, rule, prerequisite

**Times Used**:
How many of a customer's orders had a given discount applied, counted across their whole order history.
_Avoid_: Redemptions, usage count

**Already Used**:
The flag on an Eligible discount that allows one use per customer and has a Times Used of at least 1. The discount stays Eligible.
_Avoid_: Redeemed, consumed, exhausted

**Limit Reached**:
The flag on a discount whose store-wide usage limit is used up. Shopify still shows it as Active, but nobody can use it. It stays in its status group.
_Avoid_: Sold out, exhausted, depleted

**Active** / **Scheduled** / **Expired**:
A discount's status: running now, set to start in the future, or past its end date. These match Shopify's own status labels.
_Avoid_: Current, upcoming, past, ended

**Undeterminable Discount**:
A discount built on another app's Shopify Function. Its eligibility rules are hidden in that app's code, so the app lists it as "can't determine" and does not evaluate it.
_Avoid_: Unknown discount, opaque discount
