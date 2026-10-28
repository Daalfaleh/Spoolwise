import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const values = process.argv.slice(2);

function valueAfter(name) {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : "";
}

function fail(message) {
  console.error(message);
  console.error("Usage: npm run db:reassign-owner -- --from <old-owner-id> --to <supabase-user-uuid> [--local|--remote] [--persist-to <path>] [--apply]");
  process.exit(1);
}

const from = valueAfter("--from");
const to = valueAfter("--to");
const database = valueAfter("--database") || "spoolwise-inventory";
const persistTo = valueAfter("--persist-to");
const remote = args.has("--remote");
const local = args.has("--local");
const apply = args.has("--apply");

if (!/^[A-Za-z0-9_:@.-]{1,160}$/.test(from)) fail("Provide a valid existing owner ID with --from.");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(to)) {
  fail("Provide the destination Supabase user UUID with --to.");
}
if (from.toLowerCase() === to.toLowerCase()) fail("The source and destination owner IDs must be different.");
if (local && remote) fail("Choose either --local or --remote, not both.");
if (remote && persistTo) fail("--persist-to can only be used with a local database.");
if (!/^[A-Za-z0-9_-]{1,80}$/.test(database)) fail("Provide a valid D1 database name with --database.");

const scope = remote ? "--remote" : "--local";
const wranglerCli = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

function run(sql) {
  const wranglerArgs = [wranglerCli, "d1", "execute", database, scope];
  if (persistTo) wranglerArgs.push("--persist-to", persistTo);
  wranglerArgs.push("--command", sql);
  const result = spawnSync(process.execPath, wranglerArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const ownerCounts = `
  SELECT
    (SELECT COUNT(*) FROM filaments WHERE owner_id = '${from}') AS source_filaments,
    (SELECT COUNT(*) FROM filament_usage WHERE owner_id = '${from}') AS source_filament_usage,
    (SELECT COUNT(*) FROM profiles WHERE owner_id = '${from}') AS source_profiles,
    (SELECT COUNT(*) FROM filaments WHERE owner_id = '${to}') AS destination_filaments,
    (SELECT COUNT(*) FROM filament_usage WHERE owner_id = '${to}') AS destination_filament_usage,
    (SELECT COUNT(*) FROM profiles WHERE owner_id = '${to}') AS destination_profiles
`;

console.log(`Checking ${scope === "--remote" ? "remote" : "local"} records owned by ${from}...`);
run(ownerCounts);

if (!apply) {
  console.log("Dry run only. Re-run with --apply after confirming the source counts and destination UUID.");
  process.exit(0);
}

// Keep an existing Supabase profile if the user has already signed in and
// configured it. Otherwise, carry the previous profile into the new owner ID.
// Every statement is idempotent, so a retry repairs an interrupted run.
run(`
  INSERT INTO profiles (owner_id, display_name, country, preferred_currency, language, updated_at)
  SELECT '${to}', display_name, country, preferred_currency, language, updated_at
  FROM profiles WHERE owner_id = '${from}'
  ON CONFLICT(owner_id) DO NOTHING;
  DELETE FROM profiles WHERE owner_id = '${from}';
  UPDATE filament_usage SET owner_id = '${to}' WHERE owner_id = '${from}';
  UPDATE filaments SET owner_id = '${to}' WHERE owner_id = '${from}';
`);

console.log(`Owner reassignment complete. Verifying source and destination records...`);
run(ownerCounts);
