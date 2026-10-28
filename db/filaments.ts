import { env } from "cloudflare:workers";

export type FilamentRecord = {
  id: string;
  name: string;
  material: string;
  color: string;
  colorHex: string;
  colorHexes: string[];
  spoolWeightGrams: number;
  remainingWeightGrams: number;
  purchaseCost: number;
  currency: string;
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS filaments (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL DEFAULT 'legacy',
    name TEXT NOT NULL,
    material TEXT NOT NULL,
    color TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    color_hexes TEXT NOT NULL DEFAULT '[]',
    spool_weight_grams REAL NOT NULL CHECK (spool_weight_grams > 0),
    remaining_weight_grams REAL NOT NULL CHECK (remaining_weight_grams >= 0),
    purchase_cost REAL NOT NULL CHECK (purchase_cost > 0),
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`;

export function getD1() {
  if (!env.DB) throw new Error("The filament database is unavailable.");
  return env.DB;
}

export async function ensureFilamentsTable() {
  const db = getD1();
  await db.prepare(createTableSql).run();
  const columns = await db.prepare("PRAGMA table_info(filaments)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "owner_id")) {
    await db.prepare("ALTER TABLE filaments ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy'").run();
  }
  if (!columns.results.some((column) => column.name === "remaining_weight_grams")) {
    await db.prepare("ALTER TABLE filaments ADD COLUMN remaining_weight_grams REAL").run();
    await db.prepare("UPDATE filaments SET remaining_weight_grams = spool_weight_grams WHERE remaining_weight_grams IS NULL").run();
  }
  if (!columns.results.some((column) => column.name === "color_hexes")) {
    await db.prepare("ALTER TABLE filaments ADD COLUMN color_hexes TEXT NOT NULL DEFAULT '[]'").run();
    await db.prepare("UPDATE filaments SET color_hexes = '[\"' || color_hex || '\"]' WHERE color_hexes = '[]'").run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_filaments_owner_created ON filaments(owner_id, created_at)").run();
}

export function mapFilament(row: Record<string, unknown>): FilamentRecord {
  let colorHexes: string[] = [];
  try {
    const parsed = JSON.parse(String(row.color_hexes ?? "[]"));
    if (Array.isArray(parsed)) colorHexes = parsed.filter((value): value is string => typeof value === "string");
  } catch {
    colorHexes = [];
  }
  if (!colorHexes.length) colorHexes = [String(row.color_hex)];
  return {
    id: String(row.id),
    name: String(row.name),
    material: String(row.material),
    color: String(row.color),
    colorHex: String(row.color_hex),
    colorHexes,
    spoolWeightGrams: Number(row.spool_weight_grams),
    remainingWeightGrams: Number(row.remaining_weight_grams),
    purchaseCost: Number(row.purchase_cost),
    currency: String(row.currency),
  };
}
