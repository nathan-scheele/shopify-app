# Customer eligibility block

An admin block on Shopify's Customer details page (`admin.customer-details.block.render`), built with Preact and Polaris web components. It summarizes the customer's eligibility: the Active Eligible discounts, counts of Scheduled and Expired ones, and a "View all" link to the App Home customer page (`app:customers/:id`).

It works the eligibility out with the shared `eligibility` package over direct Admin API access, like App Home, and uses the package's `eligibility/format` helpers so both describe discounts and errors the same way. Merchants add the block to the customer page themselves: **Blocks → + Block → Discount eligibility**, then pin it to keep it on every customer page.

## "View all" in the dev preview

On a deployed version, "View all" opens App Home at `/customers/:id`. Under `shopify app dev`, the admin drops the path from in-admin links into the app, so the link opens App Home at `/` instead. To check the link, deploy, or open `admin.shopify.com/store/<store>/apps/<handle>/customers/<id>` directly.

## Bundle size

Admin UI extensions must stay under **64 KB compressed**. `shopify app build` reports the size of `dist/customer-eligibility-block.js`; check it whenever a dependency is added.

| Date       | Change                              | Compressed |
| ---------- | ----------------------------------- | ---------- |
| 2026-10-13 | Customer eligibility block (#11)    | ~9.5 KB    |
