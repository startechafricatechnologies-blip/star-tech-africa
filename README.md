# StarTech Africa migration plan

This project is a static storefront with a Node.js/Express backend that currently handles:

- `GET /api/apps` to list available apps
- `POST /api/initialize-payment` to start a Paystack checkout
- `GET /api/verify-payment` to confirm payment and generate a download link
- `GET /api/download/:token` to serve an APK file only after successful payment
- `GET /api/health` for service checks

The app catalog is hardcoded in `server/server.js`, not stored in a database, and orders are kept in the in-memory `orders` object. APK files are stored under `apps/*.apk` and are served from the local filesystem via `res.download()`.

## Target architecture

- Cloudflare Pages for the frontend
- Cloudflare Worker for API endpoints
- Supabase PostgreSQL for order persistence
- Supabase Storage for APK files
- Paystack remains the payment provider

## What was migrated

- Added `worker/src/index.js` to replace the Express server logic with Cloudflare Worker routing and fetch-based Paystack integration.
- Added `worker/wrangler.toml` for deployment configuration.
- Added `supabase/schema.sql` for the `apps` and `orders` tables, indexes, and row-level security policies.

## Important behavior preserved

- The storefront UI remains the same and continues to use `/api/apps`.
- Purchase flow still starts with a Paystack initialization request and redirects to Paystack.
- Payment verification still validates the Paystack transaction reference.
- Download tokens still expire after 24 hours.
- Existing app names, prices, and Paystack flow remain intact.

## Deployment checklist

1. Create a Cloudflare Pages project for the `public/` directory.
2. Create a Cloudflare Worker and deploy the code in `worker/`.
3. Add the following secrets in the Worker environment:
   - `PAYSTACK_SECRET_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
4. Set `APP_URL` to your Cloudflare Pages site URL or the Worker URL.
5. Run the SQL in `supabase/schema.sql` against your Supabase PostgreSQL instance.
6. Upload the APK files to the matching Supabase Storage bucket and keep the bucket path aligned with `storage_path` in the `apps` table.
7. Update the frontend to use the Pages + Worker origin as the host when needed.

## Local development

The legacy Node/Express server can still be used for local testing, but the production target is the Cloudflare Pages + Worker + Supabase stack.
