# Spoolwise

Spoolwise is a bilingual English/Arabic filament inventory and 3D-print costing application. It runs on Cloudflare Workers, stores each user's inventory in Cloudflare D1, and uses Supabase Auth for Google and email accounts.

This is a standalone Cloudflare application. It does not use OpenAI Sites, and `.openai/hosting.json` is intentionally absent.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Database and migrations](#database-and-migrations)
- [Authentication and email](#supabase-auth-setup)
- [Cloudflare deployment](#cloudflare-deployment)
- [Payments](#moyasar-premium-checkout)
- [Validation](#validation)
- [Security and privacy](#security-and-privacy)
- [Contributing](#contributing)
- [License](#license)

## Features

- separate Inventory, Calculator, Records, Printers, Quotes, and Connections tabs
- spool weight, price, color, and multicolor tracking
- usage records with optional deduction from a spool
- material, electricity, labor, other-cost, and profit-margin calculator
- premium on-device `.gcode` and `.3mf` parsing for model weight, print time, and purge/tower waste
- premium printer profiles with reusable power, machine-rate, currency, and default-printer settings
- premium customer quotes with saved status/history and branded A4 PDF export
- premium slicer connections that send estimate metadata only; G-code and model files stay on the user's computer
- Free and Premium plans with a five-spool free inventory limit
- Google OAuth and email/password accounts
- owner-scoped API access for every inventory and usage record
- complete English and Arabic layout, including right-to-left Arabic

## Architecture

- **Web application:** React + vinext on Cloudflare Workers
- **Inventory data:** Cloudflare D1, bound as `DB`
- **Authentication:** Supabase Auth using PKCE
- **User separation:** verified Supabase user IDs stored as `owner_id` in D1

The browser sends its Supabase access token to the application APIs. The Worker verifies that token with Supabase before reading or changing owner-scoped D1 rows.

## Project structure

| Path | Purpose |
| --- | --- |
| `app/` | Application routes, UI, and API handlers |
| `components/` | Reusable interface components |
| `lib/` and `utils/` | Shared domain, authentication, and utility logic |
| `db/` | Database schema and data-access code |
| `drizzle/` | Versioned D1 migrations |
| `public/` | Static assets and social preview image |
| `supabase/` | Supabase email templates and related configuration assets |
| `tests/` | Node test suite |
| `worker/` | Cloudflare Worker-specific integration code |

## Local setup

Requirements: Node.js 22.13 or newer.

1. Install packages with `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Add the Supabase project URL and publishable key to `.env.local`.
4. If you are deploying a fork, replace the Cloudflare account, D1, and public Supabase identifiers in `wrangler.jsonc`.
5. Apply local migrations with `npm run db:migrate:local`.
6. Run `npm run dev` and open the local URL printed in the terminal.

### Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run lint` | Run ESLint and accessibility rules |
| `npx tsc --noEmit` | Type-check without generating files |
| `npm test` | Build and run the full automated test suite |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations to the configured remote database |
| `npm run deploy` | Deploy the production Worker |

## Configuration

Copy `.env.example` to `.env.local` for development. Variables prefixed with `NEXT_PUBLIC_` are intentionally exposed to the browser; all payment, email, webhook, and encryption credentials are server-only and must be stored as encrypted Cloudflare secrets.

`wrangler.jsonc` contains the public identifiers for the current deployment. Replace `account_id`, the D1 `database_id`, and public Supabase variables when deploying a fork. These are identifiers rather than credentials; never commit production secret values.

## Database and migrations

D1 migrations are stored in `drizzle/` and should remain append-only after deployment. Create schema changes through Drizzle, review the generated SQL, test them locally, and apply them remotely only after a backup and deployment plan are in place.

## Supabase Auth setup

In the Supabase dashboard:

1. Enable email/password authentication.
2. Add the local and production site URLs to the Auth redirect allow list:
   - `http://localhost:3000/auth/callback`
   - `https://<your-worker-domain>/auth/callback`
3. Enable Google as an Auth provider and add the Google OAuth client ID and secret.
4. Configure a custom SMTP provider. New Free-plan projects cannot customize Supabase Auth templates while using the default email service.
5. In **Authentication → Email Templates → Confirm signup**, set the subject to `Verify your Spoolwise email | أكّد بريدك في Spoolwise` and paste `supabase/templates/confirmation.html` as the message body.

Only the Supabase project URL and publishable key belong in the web app. Never add a Supabase secret or service-role key to a `NEXT_PUBLIC_` variable.

## Transactional welcome email

Spoolwise sends one welcome email after an account's first verified session, including accounts created with Google. The `welcome_emails` D1 table claims and records delivery so retries, refreshes, and token changes do not create duplicates.

1. Verify a sending domain with Resend and configure that domain as the custom SMTP provider in Supabase Auth.
2. Add the Resend API key and sender identity to Cloudflare as encrypted secrets:

   ```bash
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put EMAIL_FROM
   npx wrangler secret put EMAIL_REPLY_TO
   ```

   Use a sender such as `Spoolwise <hello@mail.your-domain.com>`. `EMAIL_REPLY_TO` is optional.
3. Apply the D1 migrations, then deploy the Worker. The welcome request runs in the background and never blocks access to the application if the email provider is temporarily unavailable.

## Cloudflare deployment

1. Authenticate Wrangler with `npx wrangler login`.
2. Add the Supabase URL and publishable key to the deployment environment.
3. Apply migrations with `npm run db:migrate:remote` if the database has not been initialized.
4. Deploy with `npm run deploy`.

## Moyasar Premium checkout

Checkout uses Moyasar's hosted browser form, but Spoolwise only activates Premium after the Worker fetches and verifies the payment directly with Moyasar. Payment tokens are encrypted before D1 storage, webhook events are idempotent, and merchant secrets never reach the browser.

Before enabling Premium in production:

1. Approve the exact monthly SAR price and complete Moyasar merchant onboarding for the payment methods you intend to offer.
2. Add these Cloudflare secrets with `npx wrangler secret put <NAME>`:
   - `MOYASAR_PUBLISHABLE_KEY`
   - `MOYASAR_SECRET_KEY`
   - `MOYASAR_WEBHOOK_SECRET`
   - `MOYASAR_SAMSUNG_PAY_SERVICE_ID` (only after Samsung approves the merchant service)
   - `PREMIUM_MONTHLY_PRICE_HALALAS`
   - `SUBSCRIPTION_TOKEN_KEY` (base64-encoded 32-byte encryption key)
3. Register `https://<your-worker-domain>/api/webhooks/payment` in Moyasar and use the same webhook secret.
4. Apply the D1 migration and run a test-mode purchase before switching to live merchant keys.

The current Moyasar web integration enables mada/cards, Apple Pay, Samsung Pay, and STC Pay subject to merchant and device eligibility. It does not advertise Google Pay because Moyasar's current public web form does not document that method. Saved card tokens prepare recurring billing, but an automatic renewal schedule must be added and tested before claiming hands-off monthly renewal.

## Premium desktop slicer connection

Automatic slicer connection is reserved for the upcoming Spoolwise Desktop application. The web Connections tab presents the planned desktop workflow and does not expose manual scripts or connection tokens.

The first desktop release will target Windows and will detect supported slicers, configure them through one guided setup, and sync estimate metadata in the background. Models and G-code remain on the user's computer. The existing connection-token and metadata-ingest backend remains available as the foundation for the desktop client.

Until the desktop app launches, Premium users can parse `.gcode` and `.3mf` files privately in the web Calculator. Parsing remains on-device and the files are not uploaded.

### One-time owner migration from the previous app

The previous OpenAI-authenticated version and Supabase use different user IDs. Existing inventory, usage, and profile rows cannot be reassigned automatically without risking one account receiving another account's data.

Before cutting over a database that already contains inventory:

1. Export and import the previous D1 data into `spoolwise-inventory` if the standalone Worker uses a different D1 database.
2. Find the previous `owner_id` and the matching Supabase user UUID.
3. Preview the rows that will move:

   ```bash
   npm run db:reassign-owner -- --from <old-owner-id> --to <supabase-user-uuid> --remote
   ```

4. After confirming the counts, apply the reassignment:

   ```bash
   npm run db:reassign-owner -- --from <old-owner-id> --to <supabase-user-uuid> --remote --apply
   ```

Repeat this explicitly for every existing account. The command is intentionally opt-in and validates the destination as a Supabase UUID.

## Validation

Run the same checks enforced by GitHub Actions before opening a pull request:

```bash
npm run lint
npx tsc --noEmit
npm test
```

The test command creates a production build before running the Node test suite. UI changes should also be checked at desktop and narrow mobile widths in both English and Arabic, including keyboard navigation, visible focus, reduced-motion behavior, loading states, and error recovery.

## Security and privacy

- Inventory and usage data are scoped by verified Supabase user IDs.
- Models and G-code parsed in the Calculator stay on the user's device.
- Server credentials belong in Cloudflare secrets, never browser variables or source control.
- Generated output, local databases, dependency folders, and environment files are excluded from Git.
- Vulnerabilities should be reported privately as described in [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch, testing, pull-request, localization, and migration expectations. CI runs linting, type-checking, the production build, and the automated test suite on pushes and pull requests.

## License

No open-source license has been granted. Unless a license file is added by the owner, the source remains all rights reserved and may be viewed through GitHub but not copied, modified, or redistributed without permission.
