import { getD1, mapFilament } from "@/db/filaments";
import { supportedCurrencySet } from "@/db/profile";
import { getUserTier } from "@/db/subscription";
import { getSupabaseUser } from "@/lib/supabase/server-auth";

const allowedMaterials = new Set(["PLA", "PETG", "ABS", "ASA", "TPU", "Nylon", "Other"]);
const allowedCurrencies = supportedCurrencySet;

export async function GET(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to view your inventory." }, { status: 401 });
  const result = await getD1().prepare("SELECT * FROM filaments WHERE owner_id = ? ORDER BY created_at DESC").bind(user.id).all();
  return Response.json({ filaments: result.results.map((row) => mapFilament(row)) });
}

export async function POST(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to add filament." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 80);
  const material = String(body.material ?? "");
  const color = String(body.color ?? "").trim().slice(0, 40);
  const requestedColorHexes = Array.isArray(body.colorHexes)
    ? body.colorHexes.map((value) => String(value)).slice(0, 6)
    : [String(body.colorHex ?? "")];
  const colorHexes = requestedColorHexes.filter((value) => /^#[0-9a-f]{6}$/i.test(value));
  const colorHex = colorHexes[0] ?? "";
  const spoolWeightGrams = Number(body.spoolWeightGrams);
  const purchaseCost = Number(body.purchaseCost);
  const currency = String(body.currency ?? "");

  if (!name || !color || !allowedMaterials.has(material) || !allowedCurrencies.has(currency) ||
      colorHexes.length !== requestedColorHexes.length || colorHexes.length === 0 || !Number.isFinite(spoolWeightGrams) || spoolWeightGrams <= 0 ||
      !Number.isFinite(purchaseCost) || purchaseCost <= 0) {
    return Response.json({ error: "Please check the filament details and try again." }, { status: 400 });
  }

  const filament = {
    id: crypto.randomUUID(), name, material, color, colorHex, colorHexes,
    spoolWeightGrams, remainingWeightGrams: spoolWeightGrams, purchaseCost, currency,
  };
  const values = [filament.id, user.id, filament.name, filament.material, filament.color, filament.colorHex,
    JSON.stringify(filament.colorHexes), filament.spoolWeightGrams, filament.remainingWeightGrams, filament.purchaseCost, filament.currency, new Date().toISOString()];
  const tier = await getUserTier(user.id);
  const insert = tier.tier === "premium"
    ? await getD1().prepare(`
        INSERT INTO filaments
          (id, owner_id, name, material, color, color_hex, color_hexes, spool_weight_grams, remaining_weight_grams, purchase_cost, currency, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(...values).run()
    : await getD1().prepare(`
        INSERT INTO filaments
          (id, owner_id, name, material, color, color_hex, color_hexes, spool_weight_grams, remaining_weight_grams, purchase_cost, currency, created_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE (SELECT COUNT(*) FROM filaments WHERE owner_id = ?) < 5
      `).bind(...values, user.id).run();
  if (Number(insert.meta.changes ?? 0) === 0) {
    return Response.json({
      code: "FREE_SPOOL_LIMIT",
      error: "The free plan includes up to five filament spools. Upgrade to add more.",
    }, { status: 403 });
  }
  return Response.json({ filament }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to edit filament." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) return Response.json({ error: "A filament id is required." }, { status: 400 });

  const db = getD1();
  if (body.remainingWeightGrams !== undefined) {
    const remainingWeightGrams = Number(body.remainingWeightGrams);
    if (!Number.isFinite(remainingWeightGrams) || remainingWeightGrams < 0 || remainingWeightGrams > 100000) {
      return Response.json({ error: "Enter a valid remaining weight." }, { status: 400 });
    }
    const result = await db.prepare("UPDATE filaments SET remaining_weight_grams = ? WHERE id = ? AND owner_id = ?")
      .bind(remainingWeightGrams, id, user.id).run();
    if (!result.meta.changes) return Response.json({ error: "Filament not found." }, { status: 404 });
    return Response.json({ ok: true, remainingWeightGrams });
  }

  if (body.purchaseCost !== undefined || body.currency !== undefined) {
    const purchaseCost = Number(body.purchaseCost);
    const currency = String(body.currency ?? "");
    if (!Number.isFinite(purchaseCost) || purchaseCost <= 0 || !allowedCurrencies.has(currency)) {
      return Response.json({ error: "Enter a valid purchase price and currency." }, { status: 400 });
    }
    const result = await db.prepare("UPDATE filaments SET purchase_cost = ?, currency = ? WHERE id = ? AND owner_id = ?")
      .bind(purchaseCost, currency, id, user.id).run();
    if (!result.meta.changes) return Response.json({ error: "Filament not found." }, { status: 404 });
    return Response.json({ ok: true, purchaseCost, currency });
  }

  return Response.json({ error: "No changes were provided." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to remove filament." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "A filament id is required." }, { status: 400 });
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM filament_usage WHERE filament_id = ? AND owner_id = ?").bind(id, user.id),
    db.prepare("DELETE FROM filaments WHERE id = ? AND owner_id = ?").bind(id, user.id),
  ]);
  return Response.json({ ok: true });
}
