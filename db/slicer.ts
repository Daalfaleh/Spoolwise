import { getD1 } from "./filaments";

export type SlicerConnectionRecord = {
  id: string;
  name: string;
  slicerType: string;
  tokenPrefix: string;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
};

export type SlicerImportRecord = {
  id: string;
  connectionId: string;
  connectionName: string;
  fileName: string;
  slicer: string;
  printerName: string;
  durationSeconds: number;
  filamentGrams: number;
  wasteGrams: number;
  totalWeightGrams: number;
  createdAt: string;
};

export async function ensureSlicerTables() {
  const db = getD1();
  await db.prepare(`CREATE TABLE IF NOT EXISTS slicer_connections (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slicer_type TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    last_seen_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS slicer_imports (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    connection_id TEXT NOT NULL REFERENCES slicer_connections(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    slicer TEXT NOT NULL,
    printer_name TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    filament_grams REAL NOT NULL DEFAULT 0,
    waste_grams REAL NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_slicer_connections_owner_created ON slicer_connections(owner_id, created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_slicer_imports_owner_created ON slicer_imports(owner_id, created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_slicer_imports_connection_created ON slicer_imports(connection_id, created_at)").run();
}

export function mapSlicerConnection(row: Record<string, unknown>): SlicerConnectionRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    slicerType: String(row.slicer_type),
    tokenPrefix: String(row.token_prefix),
    active: Boolean(row.active),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    createdAt: String(row.created_at),
  };
}

export function mapSlicerImport(row: Record<string, unknown>): SlicerImportRecord {
  const filamentGrams = Number(row.filament_grams);
  const wasteGrams = Number(row.waste_grams);
  return {
    id: String(row.id),
    connectionId: String(row.connection_id),
    connectionName: String(row.connection_name ?? ""),
    fileName: String(row.file_name),
    slicer: String(row.slicer),
    printerName: String(row.printer_name ?? ""),
    durationSeconds: Number(row.duration_seconds),
    filamentGrams,
    wasteGrams,
    totalWeightGrams: filamentGrams + wasteGrams,
    createdAt: String(row.created_at),
  };
}

export async function listSlicerConnections(ownerId: string) {
  await ensureSlicerTables();
  const result = await getD1().prepare("SELECT * FROM slicer_connections WHERE owner_id = ? ORDER BY created_at DESC")
    .bind(ownerId).all<Record<string, unknown>>();
  return result.results.map(mapSlicerConnection);
}

export async function listSlicerImports(ownerId: string) {
  await ensureSlicerTables();
  const result = await getD1().prepare(`
    SELECT i.*, c.name AS connection_name
    FROM slicer_imports i
    JOIN slicer_connections c ON c.id = i.connection_id
    WHERE i.owner_id = ?
    ORDER BY i.created_at DESC
    LIMIT 100
  `).bind(ownerId).all<Record<string, unknown>>();
  return result.results.map(mapSlicerImport);
}

export async function hashSlicerToken(token: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSlicerToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `spw_sl_${base64}`;
}
