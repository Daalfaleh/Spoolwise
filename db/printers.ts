import { getD1 } from "./filaments";

export type PrinterProfileRecord = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  powerWatts: number;
  hourlyRate: number;
  currency: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function ensurePrinterProfilesTable() {
  const db = getD1();
  await db.prepare(`CREATE TABLE IF NOT EXISTS printer_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    manufacturer TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    power_watts REAL NOT NULL DEFAULT 150 CHECK (power_watts >= 0),
    hourly_rate REAL NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
    currency TEXT NOT NULL DEFAULT 'SAR',
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_printer_profiles_owner_created ON printer_profiles(owner_id, created_at)").run();
}

export function mapPrinterProfile(row: Record<string, unknown>): PrinterProfileRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    manufacturer: String(row.manufacturer ?? ""),
    model: String(row.model ?? ""),
    powerWatts: Number(row.power_watts),
    hourlyRate: Number(row.hourly_rate),
    currency: String(row.currency),
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listPrinterProfiles(ownerId: string) {
  await ensurePrinterProfilesTable();
  const result = await getD1().prepare(`
    SELECT * FROM printer_profiles
    WHERE owner_id = ?
    ORDER BY is_default DESC, created_at DESC
  `).bind(ownerId).all<Record<string, unknown>>();
  return result.results.map(mapPrinterProfile);
}
