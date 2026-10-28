import { getD1 } from "@/db/filaments";
import { getQuote, listQuotes } from "@/db/quotes";
import { supportedCurrencySet } from "@/db/profile";
import type { QuoteData, QuoteLine } from "@/lib/quotes/types";
import { requirePremiumUser } from "@/lib/subscriptions/server";

const statuses = new Set(["draft", "sent", "accepted", "expired"]);

function finite(value: unknown, max = 10_000_000) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

function cleanQuoteData(value: unknown): QuoteData | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const rawItems = Array.isArray(input.items) ? input.items.slice(0, 8) : [];
  const items: QuoteLine[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const grams = finite(row.grams, 1_000_000);
    const unitCostPerGram = finite(row.unitCostPerGram);
    const amount = finite(row.amount);
    const name = String(row.name ?? "").trim().slice(0, 80);
    if (!name || grams === null || unitCostPerGram === null || amount === null) return null;
    items.push({
      filamentId: String(row.filamentId ?? "").slice(0, 80),
      name,
      material: String(row.material ?? "").trim().slice(0, 40),
      color: String(row.color ?? "").trim().slice(0, 40),
      grams,
      unitCostPerGram,
      amount,
    });
  }
  if (!items.length) return null;
  const rawCosts = input.costs as Record<string, unknown> | undefined;
  if (!rawCosts) return null;
  const keys = ["material", "electricity", "labor", "machine", "other", "total", "profitPercent", "profit", "suggestedPrice"] as const;
  const parsed = Object.fromEntries(keys.map((key) => [key, finite(rawCosts[key])])) as Record<(typeof keys)[number], number | null>;
  if (keys.some((key) => parsed[key] === null)) return null;
  return {
    printerId: input.printerId ? String(input.printerId).slice(0, 80) : null,
    printerName: String(input.printerName ?? "").trim().slice(0, 100),
    slicer: String(input.slicer ?? "").trim().slice(0, 60),
    sourceFileName: String(input.sourceFileName ?? "").trim().slice(0, 180),
    durationMinutes: finite(input.durationMinutes, 60 * 24 * 365) ?? 0,
    items,
    costs: parsed as QuoteData["costs"],
    notes: String(input.notes ?? "").trim().slice(0, 1000),
  };
}

function quoteNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `SPW-${date}-${suffix}`;
}

export async function GET(request: Request) {
  const auth = await requirePremiumUser(request, "instant quotes");
  if (auth.response) return auth.response;
  return Response.json({ quotes: await listQuotes(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requirePremiumUser(request, "instant quotes");
  if (auth.response) return auth.response;
  if (Number(request.headers.get("content-length") ?? 0) > 65_536) {
    return Response.json({ error: "Quote details are too large." }, { status: 413 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const projectName = String(body.projectName ?? "").trim().slice(0, 120);
  const customerName = String(body.customerName ?? "").trim().slice(0, 120);
  const customerEmail = String(body.customerEmail ?? "").trim().slice(0, 180);
  const currency = String(body.currency ?? "");
  const validUntil = body.validUntil ? String(body.validUntil) : null;
  const data = cleanQuoteData(body.data);
  if (!projectName || !supportedCurrencySet.has(currency) || !data ||
      (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) ||
      (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil))) {
    return Response.json({ error: "Check the quote details and try again." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO quotes
      (id, owner_id, quote_number, project_name, customer_name, customer_email, currency, status,
       total_cost, suggested_price, valid_until, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
  `).bind(id, auth.user.id, quoteNumber(), projectName, customerName, customerEmail, currency,
    data.costs.total, data.costs.suggestedPrice, validUntil, JSON.stringify(data), now, now).run();
  const quote = await getQuote(auth.user.id, id);
  return Response.json({ quote }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requirePremiumUser(request, "instant quotes");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !statuses.has(status)) {
    return Response.json({ error: "Invalid quote update." }, { status: 400 });
  }
  const result = await getD1().prepare("UPDATE quotes SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
    .bind(status, new Date().toISOString(), id, auth.user.id).run();
  if (!result.meta.changes) return Response.json({ error: "Quote not found." }, { status: 404 });
  const quote = await getQuote(auth.user.id, id);
  return Response.json({ quote });
}

export async function DELETE(request: Request) {
  const auth = await requirePremiumUser(request, "instant quotes");
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "A quote id is required." }, { status: 400 });
  const result = await getD1().prepare("DELETE FROM quotes WHERE id = ? AND owner_id = ?").bind(id, auth.user.id).run();
  if (!result.meta.changes) return Response.json({ error: "Quote not found." }, { status: 404 });
  return Response.json({ ok: true });
}
