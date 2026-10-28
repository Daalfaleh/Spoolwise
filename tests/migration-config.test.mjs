import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("targets the dedicated Cloudflare D1 database without Sites", async () => {
  const [wrangler, vite] = await Promise.all([
    read("wrangler.jsonc"),
    read("vite.config.ts"),
  ]);

  assert.match(wrangler, /"name": "spoolwise"/);
  assert.match(wrangler, /"binding": "DB"/);
  assert.match(wrangler, /"database_name": "spoolwise-inventory"/);
  assert.match(wrangler, /55bb7831-8154-49a7-8c60-dc6117efe723/);
  assert.match(vite, /@cloudflare\/vite-plugin/);
  assert.doesNotMatch(vite, /sites-vite-plugin|\.openai\/hosting/);
});

test("offers Supabase Google and email authentication", async () => {
  const [login, callback, guard, oauthCallback] = await Promise.all([
    read("app/login/LoginPage.tsx"),
    read("app/auth/callback/page.tsx"),
    read("lib/supabase/use-session.ts"),
    read("lib/supabase/oauth-callback.js"),
  ]);

  assert.match(login, /signInWithOAuth/);
  assert.match(login, /provider: "google"/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /auth\.signUp/);
  assert.match(callback, /resolveOAuthCallback/);
  assert.match(oauthCallback, /exchangeCodeForSession/);
  assert.match(guard, /auth\.onAuthStateChange/);
  assert.match(guard, /auth\.signOut/);
});

test("sends one branded welcome email for every verified provider", async () => {
  const [authenticatedApp, route, delivery, schema, confirmationTemplate] = await Promise.all([
    read("app/app/AuthenticatedApp.tsx"),
    read("app/api/welcome/route.ts"),
    read("db/welcome-email.ts"),
    read("db/schema.ts"),
    read("supabase/templates/confirmation.html"),
  ]);

  assert.match(authenticatedApp, /fetch\("\/api\/welcome"/);
  assert.match(authenticatedApp, /session\.access_token/);
  assert.match(route, /getSupabaseUser\(request\)/);
  assert.match(route, /renderWelcomeEmail/);
  assert.match(delivery, /INSERT OR IGNORE INTO welcome_emails/);
  assert.match(delivery, /status = 'sent'/);
  assert.match(schema, /welcomeEmails/);
  assert.match(confirmationTemplate, /\{\{ \.ConfirmationURL \}\}/);
});

test("verifies Supabase users before owner-scoped inventory access", async () => {
  const [filaments, usage, serverAuth] = await Promise.all([
    read("app/api/filaments/route.ts"),
    read("app/api/usage/route.ts"),
    read("lib/supabase/server-auth.ts"),
  ]);

  assert.match(serverAuth, /auth\.getUser\(token\)/);
  assert.match(filaments, /getSupabaseUser\(request\)/);
  assert.match(filaments, /WHERE owner_id = \?/);
  assert.match(usage, /getSupabaseUser\(request\)/);
  assert.match(usage, /WHERE u\.owner_id = \?/);
  assert.doesNotMatch(`${filaments}\n${usage}`, /claimLegacyData/);
});

test("provides an explicit and retry-safe owner cutover", async () => {
  const migration = await read("scripts/reassign-owner.mjs");

  assert.match(migration, /source and destination owner IDs must be different/);
  assert.match(migration, /ON CONFLICT\(owner_id\) DO NOTHING/);
  assert.match(migration, /DELETE FROM profiles WHERE owner_id/);
  assert.match(migration, /UPDATE filament_usage SET owner_id/);
  assert.match(migration, /UPDATE filaments SET owner_id/);
  assert.match(migration, /Dry run only/);
});

test("deducts several spools in one multicolor recording", async () => {
  const [usage, validation, migration, app] = await Promise.all([
    read("app/api/usage/route.ts"),
    read("lib/usage-entries.js"),
    read("drizzle/0005_prevent_negative_remaining.sql"),
    read("app/SpoolwiseApp.tsx"),
  ]);

  assert.match(validation, /Array\.isArray\(body\.entries\)/);
  assert.match(validation, /raw\.length > MAX_USAGE_ENTRIES/);
  assert.match(usage, /remaining_weight_grams = remaining_weight_grams - \?/);
  assert.match(usage, /AND id IN \(/);
  assert.match(migration, /INSUFFICIENT_FILAMENT/);
  assert.match(app, /body: JSON\.stringify\(\{ partName, deducted: deductUsage, entries \}\)/);
});

test("keeps account preferences on their own owner-scoped page", async () => {
  const [profileRoute, profileDb, migration, accountPage, app] = await Promise.all([
    read("app/api/profile/route.ts"),
    read("db/profile.ts"),
    read("drizzle/0004_medical_warbound.sql"),
    read("app/account/AccountPage.tsx"),
    read("app/SpoolwiseApp.tsx"),
  ]);

  assert.match(profileRoute, /getSupabaseUser\(request\)/);
  assert.match(profileRoute, /WHERE owner_id = \?/);
  assert.match(profileRoute, /ON CONFLICT\(owner_id\) DO UPDATE/);
  assert.match(profileDb, /supportedCurrencies/);
  assert.match(migration, /CREATE TABLE `profiles`/);
  assert.match(accountPage, /useSupabaseSession/);
  assert.match(accountPage, /method: "PATCH"/);
  // The workbench links out to the account page instead of hosting a fourth tab.
  assert.match(app, /<a href="\/account" role="menuitem">/);
  assert.doesNotMatch(app, /account-panel/);
});

test("keeps each feature group in its own tab", async () => {
  const app = await read("app/SpoolwiseApp.tsx");

  const feature = (startMarker, endMarker) => {
    const start = app.indexOf(startMarker);
    assert.notEqual(start, -1, `${startMarker} is missing`);
    const end = app.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(end, -1, `${endMarker} is missing`);
    return app.slice(start, end);
  };

  // Inventory manages filaments only: no usage form and no usage history.
  const management = feature(
    'activeTab === "inventory" && inventorySection === "manage"',
    'activeTab === "calculator" && (',
  );
  assert.match(management, /updateRemainingWeight/);
  assert.match(management, /updatePurchasePrice/);
  assert.match(management, /inventory-overview/);
  assert.doesNotMatch(management, /addUsedPart/);
  assert.doesNotMatch(management, /usage-history/);

  // Records owns both logging and reviewing usage.
  assert.match(app, /activeTab === "records" && recordsSection === "log"/);
  assert.match(app, /activeTab === "records" && recordsSection === "history"/);
  assert.match(app, /onSubmit=\{addUsedPart\}/);
  assert.match(app, /ledgerUsage\.map/);

  // Major workflows are conditionally rendered, not merely hidden together in one workspace.
  assert.match(app, /activeTab === "inventory" && inventorySection === "add"/);
  assert.match(app, /activeTab === "inventory" && inventorySection === "manage"/);
  assert.match(app, /activeTab === "calculator" && \(/);
  assert.match(app, /activeTab === "printers" && \(/);
  assert.match(app, /activeTab === "quotes" && \(/);
  assert.match(app, /activeTab === "slicer" && \(/);
  assert.doesNotMatch(app, /tab-hidden/);

  // The calculator holds only calculation controls and results.
  const calculator = feature(
    'activeTab === "calculator" && (',
    'activeTab === "printers" && (',
  );
  assert.match(calculator, /calculator-inputs/);
  assert.match(calculator, /suggested-price/);
  assert.doesNotMatch(calculator, /addUsedPart|updatePurchasePrice|record-ledger/);
});

test("keeps authentication implementation details off the sign-in page", async () => {
  const [login, css] = await Promise.all([
    read("app/login/LoginPage.tsx"),
    read("app/globals.css"),
  ]);

  assert.doesNotMatch(login, /Authentication is securely provided by Supabase/);
  assert.doesNotMatch(login, /تتم المصادقة بأمان عبر Supabase/);
  assert.doesNotMatch(login, /login-secure|text\.secure/);
  assert.doesNotMatch(css, /\.login-secure/);
});

test("renders on phones and hides the pricing formula", async () => {
  const [layout, app, css] = await Promise.all([
    read("app/layout.tsx"),
    read("app/SpoolwiseApp.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(layout, /export const viewport: Viewport/);
  assert.match(layout, /width: "device-width"/);
  assert.doesNotMatch(app, /PRICE = \(FILAMENT/);
  assert.doesNotMatch(app, /×\s*\{money\(costPerGram/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
});
