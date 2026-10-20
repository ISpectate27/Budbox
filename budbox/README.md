# BUDBOX ordering: storefront + order dashboard (Vercel)

No npm dependencies. Orders are stored in Upstash Redis (free tier).

## Deploy (about 10 minutes)
1. Put this folder on GitHub (or run `npx vercel` in this folder) and import it as a new Vercel project.
   Framework preset: "Other". No build command. Leave everything else default.
2. In the Vercel project: Storage -> Create / Marketplace -> **Upstash Redis** (free plan) -> Connect to this
   project. This adds the database variables automatically.
3. Settings -> Environment Variables: add `ADMIN_PASSWORD` (long and unique).
   Optional: `ADMIN_EMAIL` (defaults to beats4vertt@gmail.com).
4. Redeploy (Deployments -> ... -> Redeploy), so the new variables apply.

- Storefront: https://YOUR-SITE.vercel.app/
- Dashboard:  https://YOUR-SITE.vercel.app/admin  (email + ADMIN_PASSWORD)

## How orders flow
Customer taps "Text my order": the order is saved to the dashboard AND their phone opens a pre-filled
text to 289-988-6684. Prices are recalculated on the server, so they can't be edited in the browser.
If the dashboard save fails for any reason, the text message still goes through.

## Layout
- `public/index.html`        storefront (edit prices/sizes here AND in `lib/common.js`, they must match)
- `public/admin/index.html`  dashboard
- `api/*`                    serverless functions
- `lib/common.js`            menu/prices, validation, database + login helpers
