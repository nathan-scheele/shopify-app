# Customer eligibility block

An admin block on Shopify's Customer details page (`admin.customer-details.block.render`), built with Preact and Polaris web components. It summarizes the customer's eligibility: the Active Eligible discounts, counts of Scheduled and Expired ones, and a "View all" link that opens the App Home customer page in a new tab.

It works the eligibility out with the shared `eligibility` package over direct Admin API access, like App Home, and uses the package's `eligibility/format` helpers so both describe discounts and errors the same way. Merchants add the block to the customer page themselves: **Blocks → + Block → Discount eligibility**, then pin it to keep it on every customer page.

## "View all" link

The link is a full admin URL (`admin.shopify.com/store/<store>/apps/<app handle>/customers/<id>`) with `target="_blank"`. The block looks up the store and app handles with one Admin API query, because Shopify's `app:` links fall short in two ways:

- The admin opens `app:` links in the current tab and ignores `target`.
- Under `shopify app dev`, every in-admin link into the app loses its path and query, so it opens App Home at `/`. Released versions keep the path.

If the lookup fails, the link falls back to `app:customers/<id>`, which opens in the current tab.

## Bundle size

Admin UI extensions must stay under **64 KB compressed**. `shopify app build` reports the size of `dist/customer-eligibility-block.js`; check it whenever a dependency is added.

| Date       | Change                              | Compressed |
| ---------- | ----------------------------------- | ---------- |
| 2026-10-13 | Customer eligibility block (#11)    | ~9.6 KB    |
