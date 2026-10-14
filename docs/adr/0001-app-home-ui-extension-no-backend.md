# App Home as a UI extension, with no backend

We build an extension-only app whose App Home is an App Home UI extension (`admin.app.home.render`), not the iframe model, and we run no server. Every page and block works out eligibility in the browser through direct Admin GraphQL. The Customer details block has to do this anyway, and the app isn't hosted, so a server would only handle OAuth and sessions, and the admin app would stop working whenever `shopify app dev` wasn't running. Shopify supports moving from the extension to the iframe model but not back, so this is also the choice that keeps both options open.

## Consequences

- The 64 KB compressed bundle limit applies to every App Home page together. It, not page count, is what limits growth.
- Custom distribution only, installed on a development store on the Plus plan (Shopify only allows custom apps that use Functions on Plus or dev stores).
- The shopper-facing eligibility view (v2) will need a backend that the extension calls with `fetch` and an ID token, or a move to the iframe model.
- Features outside discounts may be added later. They share the same App Home bundle, so the bundle limit, not page count, is what would push a move to the iframe model.
