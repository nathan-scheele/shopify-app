# App Home

The app's main page, an App Home UI extension (`admin.app.home.render`) built with Preact and Polaris web components. See ADR 0001 for why it has no backend.

## Routes

- `/`: customer search by name or email, 25 per page. The search term and page cursor live in the URL (`/?q=ada&after=<cursor>`), so the back button from a customer's page returns to the same results. Each word must prefix-match the customer's first name, last name or email.
- `/customers/:id`: the customer's Eligible discounts (so far only those open to all customers), grouped Active / Scheduled / Expired (Expired collapsed), worked out by the shared `eligibility` package over direct Admin API access.

## Bundle size

App Home UI extensions must stay under **64 KB compressed**. `shopify app build` reports the size of `dist/app-home.js`; check it whenever a route or dependency is added.

| Date       | Change                              | Compressed |
| ---------- | ----------------------------------- | ---------- |
| 2026-10-13 | Customer eligibility page (#5)      | ~9.2 KB    |
| 2026-10-13 | Customer search and app nav (#7)    | ~10.1 KB   |
