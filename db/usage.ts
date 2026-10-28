import { ensureFilamentsTable, getD1 } from "./filaments";

export type UsageRecord = {
  id: string;
  filamentId: string;
  filamentName: string;
  partName: string;
  gramsUsed: number;
  deducted: boolean;
  createdAt: string;
};

const createUsageTableSql = `
  CREATE TABLE IF NOT EXISTS filament_usage (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL DEFAULT 'legacy',
    filament_id TEXT NOT NULL,
    part_name TEXT NOT NULL,
    grams_used REAL NOT NULL CHECK (grams_used > 0),
    deducted INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (filament_id) REFERENCES filaments(id) ON DELETE CASCADE
  )
`;

export async function ensureUsageTable() {
  await ensureFilamentsTable();
  const db = getD1();
  await db.prepare(createUsageTableSql).run();
  const columns = await db.prepare("PRAGMA table_info(filament_usage)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "owner_id")) {
    await db.prepare("ALTER TABLE filament_usage ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy'").run();
  }
  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS idx_filament_usage_filament_created ON filament_usage(filament_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_filament_usage_owner_created ON filament_usage(owner_id, created_at)"),
  ]);
}

export function mapUsage(row: Record<string, unknown>): UsageRecord {
  return {
    id: String(row.id),
    filamentId: String(row.filament_id),
    filamentName: String(row.filament_name ?? "Filament"),
    partName: String(row.part_name),
    gramsUsed: Number(row.grams_used),
    deducted: Boolean(row.deducted),
    createdAt: String(row.created_at),
  };
}
