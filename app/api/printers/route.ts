import { getD1 } from "@/db/filaments";
import { listPrinterProfiles, mapPrinterProfile } from "@/db/printers";
import { supportedCurrencySet } from "@/db/profile";
import { requirePremiumUser } from "@/lib/subscriptions/server";

const MAX_PRINTERS = 50;

function printerInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim().slice(0, 80);
  const manufacturer = String(body.manufacturer ?? "").trim().slice(0, 80);
  const model = String(body.model ?? "").trim().slice(0, 80);
  const powerWatts = Number(body.powerWatts);
  const hourlyRate = Number(body.hourlyRate);
  const currency = String(body.currency ?? "");
  const isDefault = body.isDefault === true;
  if (!name || !Number.isFinite(powerWatts) || powerWatts < 0 || powerWatts > 20_000 ||
      !Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 100_000 || !supportedCurrencySet.has(currency)) {
    return null;
  }
  return { name, manufacturer, model, powerWatts, hourlyRate, currency, isDefault };
}

export async function GET(request: Request) {
  const auth = await requirePremiumUser(request, "printer profiles");
  if (auth.response) return auth.response;
  return Response.json({ printers: await listPrinterProfiles(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requirePremiumUser(request, "printer profiles");
  if (auth.response) return auth.response;
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }
  const input = printerInput(await request.json().catch(() => ({})) as Record<string, unknown>);
  if (!input) return Response.json({ error: "Check the printer profile details." }, { status: 400 });

  const db = getD1();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM printer_profiles WHERE owner_id = ?")
    .bind(auth.user.id).first<{ count: number }>();
  if (Number(count?.count ?? 0) >= MAX_PRINTERS) {
    return Response.json({ error: `You can save up to ${MAX_PRINTERS} printer profiles.` }, { status: 409 });
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const makeDefault = input.isDefault || Number(count?.count ?? 0) === 0;
  const statements = [];
  if (makeDefault) {
    statements.push(db.prepare("UPDATE printer_profiles SET is_default = 0, updated_at = ? WHERE owner_id = ?")
      .bind(now, auth.user.id));
  }
  statements.push(db.prepare(`
    INSERT INTO printer_profiles
      (id, owner_id, name, manufacturer, model, power_watts, hourly_rate, currency, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, auth.user.id, input.name, input.manufacturer, input.model, input.powerWatts,
    input.hourlyRate, input.currency, makeDefault ? 1 : 0, now, now));
  await db.batch(statements);
  const row = await db.prepare("SELECT * FROM printer_profiles WHERE id = ? AND owner_id = ?")
    .bind(id, auth.user.id).first<Record<string, unknown>>();
  return Response.json({ printer: mapPrinterProfile(row!) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requirePremiumUser(request, "printer profiles");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.id ?? "");
  const input = printerInput(body);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !input) {
    return Response.json({ error: "Check the printer profile details." }, { status: 400 });
  }
  const db = getD1();
  const now = new Date().toISOString();
  const statements = [];
  if (input.isDefault) {
    statements.push(db.prepare("UPDATE printer_profiles SET is_default = 0, updated_at = ? WHERE owner_id = ?")
      .bind(now, auth.user.id));
  }
  statements.push(db.prepare(`
    UPDATE printer_profiles
    SET name = ?, manufacturer = ?, model = ?, power_watts = ?, hourly_rate = ?, currency = ?,
        is_default = CASE WHEN ? = 1 THEN 1 ELSE is_default END, updated_at = ?
    WHERE id = ? AND owner_id = ?
  `).bind(input.name, input.manufacturer, input.model, input.powerWatts, input.hourlyRate,
    input.currency, input.isDefault ? 1 : 0, now, id, auth.user.id));
  const results = await db.batch(statements);
  if (!Number(results.at(-1)?.meta.changes ?? 0)) return Response.json({ error: "Printer profile not found." }, { status: 404 });
  const row = await db.prepare("SELECT * FROM printer_profiles WHERE id = ? AND owner_id = ?")
    .bind(id, auth.user.id).first<Record<string, unknown>>();
  return Response.json({ printer: mapPrinterProfile(row!) });
}

export async function DELETE(request: Request) {
  const auth = await requirePremiumUser(request, "printer profiles");
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "A printer id is required." }, { status: 400 });
  const db = getD1();
  const existing = await db.prepare("SELECT is_default FROM printer_profiles WHERE id = ? AND owner_id = ?")
    .bind(id, auth.user.id).first<{ is_default: number }>();
  if (!existing) return Response.json({ error: "Printer profile not found." }, { status: 404 });
  await db.prepare("DELETE FROM printer_profiles WHERE id = ? AND owner_id = ?").bind(id, auth.user.id).run();
  if (existing.is_default) {
    await db.prepare(`UPDATE printer_profiles SET is_default = 1, updated_at = ? WHERE id = (
      SELECT id FROM printer_profiles WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1
    )`).bind(new Date().toISOString(), auth.user.id).run();
  }
  return Response.json({ ok: true });
}
