import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

async function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const migrationRoot = new URL("../drizzle/", import.meta.url);
  const migrations = (await readdir(migrationRoot))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();

  for (const migration of migrations) {
    const sql = await readFile(new URL(migration, migrationRoot), "utf8");
    database.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }
  return database;
}

function seedSpool(database) {
  database.prepare(`
    INSERT INTO filaments
      (id, owner_id, name, material, color, color_hex, color_hexes, spool_weight_grams, remaining_weight_grams, purchase_cost, currency, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("spool-a", "owner-a", "Black PLA", "PLA", "Black", "#000000", '["#000000"]', 1000, 50, 80, "SAR", "2026-08-10T00:00:00.000Z");
}

test("negative inventory aborts and rolls back the usage batch", async () => {
  const database = await migratedDatabase();
  seedSpool(database);

  assert.throws(() => database.exec(`
    BEGIN;
    INSERT INTO filament_usage (id, owner_id, filament_id, part_name, grams_used, deducted, created_at)
    VALUES ('usage-a', 'owner-a', 'spool-a', 'Oversized print', 60, 1, '2026-08-10T00:00:00.000Z');
    UPDATE filaments SET remaining_weight_grams = remaining_weight_grams - 60 WHERE id = 'spool-a';
    COMMIT;
  `), /INSUFFICIENT_FILAMENT/);

  database.exec("ROLLBACK");
  assert.equal(database.prepare("SELECT remaining_weight_grams FROM filaments WHERE id = 'spool-a'").get().remaining_weight_grams, 50);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM filament_usage").get().count, 0);
  database.close();
});

test("valid inventory deduction commits normally", async () => {
  const database = await migratedDatabase();
  seedSpool(database);

  database.exec(`
    BEGIN;
    INSERT INTO filament_usage (id, owner_id, filament_id, part_name, grams_used, deducted, created_at)
    VALUES ('usage-a', 'owner-a', 'spool-a', 'Valid print', 40, 1, '2026-08-10T00:00:00.000Z');
    UPDATE filaments SET remaining_weight_grams = remaining_weight_grams - 40 WHERE id = 'spool-a';
    COMMIT;
  `);

  assert.equal(database.prepare("SELECT remaining_weight_grams FROM filaments WHERE id = 'spool-a'").get().remaining_weight_grams, 10);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM filament_usage").get().count, 1);
  database.close();
});
