# Customer eligibility block

An admin block on Shopify's Customer details page (`admin.customer-details.block.render`), built with Preact and Polaris web components. It summarizes the customer's eligibility: the Active Eligible discounts, counts of Scheduled and Expired ones, and a "View all" link to the App Home customer page (`app:customers/:id`).

It works the eligibility out with the shared `eligibility` package over direct Admin API access, like App Home, and uses the package's `eligibility/format` helpers so both describe discounts and errors the same way. Merchants add the block to the customer page themselves: **Blocks → + Block → Discount eligibility**, then pin it to keep it on every customer page.

## Known issue: "View all" opens App Home's first page

In the dev preview (`shopify app dev`) the admin rewrites every in-admin link into the app to `/admin/apps/<handle>`, dropping the path and query. "View all" therefore opens App Home at `/` instead of `/customers/:id`. The same happens with relative URLs, `shopify://admin/apps/<handle>/…` and `target="_blank"`, while loading `admin.shopify.com/store/<store>/apps/<handle>/customers/<id>` directly works. The link uses the documented `app:` form; check it again on a deployed app version.

## Bundle size

Admin UI extensions must stay under **64 KB compressed**. `shopify app build` reports the size of `dist/customer-eligibility-block.js`; check it whenever a dependency is added.

| Date       | Change                              | Compressed |
| ---------- | ----------------------------------- | ---------- |
| 2026-10-13 | Customer eligibility block (#11)    | ~9.5 KB    |
