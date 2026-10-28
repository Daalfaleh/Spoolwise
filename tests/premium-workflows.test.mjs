import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("premium workflow APIs enforce the paid tier on the server", async () => {
  const routes = await Promise.all([
    read("app/api/printers/route.ts"),
    read("app/api/quotes/route.ts"),
    read("app/api/quotes/pdf/route.ts"),
    read("app/api/slicer/connections/route.ts"),
    read("app/api/slicer/imports/route.ts"),
  ]);
  for (const route of routes) assert.match(route, /requirePremiumUser\(/);

  const guard = await read("lib/subscriptions/server.ts");
  assert.match(guard, /getSupabaseUser\(request\)/);
  assert.match(guard, /getUserTier\(user\.id\)/);
  assert.match(guard, /PREMIUM_REQUIRED/);
});

test("slicer ingest uses a one-way token and stores metadata rather than print files", async () => {
  const [ingest, slicerDb, bridge] = await Promise.all([
    read("app/api/slicer/ingest/route.ts"),
    read("db/slicer.ts"),
    read("public/spoolwise-slicer-bridge.ps1"),
  ]);
  assert.match(slicerDb, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(slicerDb, /spw_sl_/);
  assert.match(ingest, /getUserTier\(String\(connection\.owner_id\)\)/);
  assert.match(ingest, /filamentGrams/);
  assert.doesNotMatch(ingest, /gcodePath|fileBytes|arrayBuffer\(/);
  assert.match(bridge, /Get-Content -LiteralPath/);
  assert.match(bridge, /Invoke-RestMethod/);
  assert.doesNotMatch(bridge, /-InFile/);
});

test("slicer bridge has an explicit downloadable Worker route", async () => {
  const [route, connections, bridgeModule, publicBridge] = await Promise.all([
    read("app/api/slicer/bridge/route.ts"),
    read("app/api/slicer/connections/route.ts"),
    read("lib/slicer/bridge-script.ts"),
    read("public/spoolwise-slicer-bridge.ps1"),
  ]);
  assert.match(route, /Content-Disposition.*spoolwise-slicer-bridge\.ps1/);
  assert.match(route, /X-Content-Type-Options.*nosniff/);
  assert.match(connections, /bridgeUrl: `\$\{origin\}\/api\/slicer\/bridge`/);
  const embeddedBridge = bridgeModule.match(/String\.raw`([\s\S]*)`;\s*$/)?.[1];
  assert.equal(embeddedBridge?.trim(), publicBridge.trim());
});

test("the web app reserves automatic slicer connections for Spoolwise Desktop", async () => {
  const [panel, app] = await Promise.all([
    read("components/SlicerConnectionsPanel.tsx"),
    read("app/SpoolwiseApp.tsx"),
  ]);
  assert.match(panel, /Desktop only/);
  assert.match(panel, /Coming soon/);
  assert.match(panel, /Easy slicer setup is coming soon/);
  assert.match(panel, /Import a file in Calculator/);
  assert.match(panel, /Models and G-code stay on your computer/);
  assert.doesNotMatch(panel, /Connect your slicer without scripts or manual setup|Create connection|Copy setup command|Download the Windows bridge|setup\.command/);
  assert.match(app, /<small>\{t\("Desktop app"\)\}<\/small>/);
});

test("printer, quote, and slicer data have dedicated D1 tables", async () => {
  const migration = await read("drizzle/0008_sloppy_ogun.sql");
  for (const table of ["printer_profiles", "quotes", "slicer_connections", "slicer_imports"]) {
    assert.match(migration, new RegExp(`CREATE TABLE .${table}.`));
  }
  assert.match(migration, /slicer_connections_token_hash_unique/);
  assert.match(migration, /FOREIGN KEY \(`connection_id`\)/);
});

test("quote PDF export is branded and premium protected", async () => {
  const [pdf, route] = await Promise.all([
    read("lib/quotes/pdf.ts"),
    read("app/api/quotes/pdf/route.ts"),
  ]);
  assert.match(pdf, /PDFDocument\.create\(\)/);
  assert.match(pdf, /SPOOLWISE/);
  assert.match(pdf, /Generated with Spoolwise Premium/);
  assert.match(route, /requirePremiumUser\(request, "PDF quote exports"\)/);
  assert.match(route, /Content-Type": "application\/pdf/);
  assert.match(route, /Cache-Control": "private, no-store/);
});
