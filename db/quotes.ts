import { getD1 } from "./filaments";
import type { QuoteData, QuoteRecord } from "@/lib/quotes/types";

export async function ensureQuotesTable() {
  const db = getD1();
  await db.prepare(`CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    quote_number TEXT NOT NULL,
    project_name TEXT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_email TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'expired')),
    total_cost REAL NOT NULL CHECK (total_cost >= 0),
    suggested_price REAL NOT NULL CHECK (suggested_price >= 0),
    valid_until TEXT,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_quotes_owner_created ON quotes(owner_id, created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_quotes_owner_number ON quotes(owner_id, quote_number)").run();
}

export function mapQuote(row: Record<string, unknown>): QuoteRecord {
  let data: QuoteData;
  try {
    data = JSON.parse(String(row.data_json)) as QuoteData;
  } catch {
    data = {
      printerId: null, printerName: "", slicer: "", sourceFileName: "", durationMinutes: 0,
      items: [], notes: "",
      costs: { material: 0, electricity: 0, labor: 0, machine: 0, other: 0, total: 0, profitPercent: 0, profit: 0, suggestedPrice: 0 },
    };
  }
  return {
    id: String(row.id),
    quoteNumber: String(row.quote_number),
    projectName: String(row.project_name),
    customerName: String(row.customer_name ?? ""),
    customerEmail: String(row.customer_email ?? ""),
    currency: String(row.currency),
    status: String(row.status) as QuoteRecord["status"],
    totalCost: Number(row.total_cost),
    suggestedPrice: Number(row.suggested_price),
    validUntil: row.valid_until ? String(row.valid_until) : null,
    data,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listQuotes(ownerId: string) {
  await ensureQuotesTable();
  const result = await getD1().prepare("SELECT * FROM quotes WHERE owner_id = ? ORDER BY created_at DESC LIMIT 500")
    .bind(ownerId).all<Record<string, unknown>>();
  return result.results.map(mapQuote);
}

export async function getQuote(ownerId: string, id: string) {
  await ensureQuotesTable();
  const row = await getD1().prepare("SELECT * FROM quotes WHERE id = ? AND owner_id = ?")
    .bind(id, ownerId).first<Record<string, unknown>>();
  return row ? mapQuote(row) : null;
}
