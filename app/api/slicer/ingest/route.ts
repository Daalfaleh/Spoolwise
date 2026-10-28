import { getD1 } from "@/db/filaments";
import { ensureSlicerTables, hashSlicerToken } from "@/db/slicer";
import { getUserTier } from "@/db/subscription";

function numberInRange(value: unknown, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) {
    return Response.json({ error: "Slicer metadata is too large." }, { status: 413 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!/^spw_sl_[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return Response.json({ error: "Invalid slicer connection token." }, { status: 401 });
  }
  await ensureSlicerTables();
  const db = getD1();
  const connection = await db.prepare(`
    SELECT id, owner_id, name, slicer_type
    FROM slicer_connections
    WHERE token_hash = ? AND active = 1
  `).bind(await hashSlicerToken(token)).first<Record<string, unknown>>();
  if (!connection) return Response.json({ error: "Slicer connection not found." }, { status: 401 });
  const tier = await getUserTier(String(connection.owner_id));
  if (tier.tier !== "premium") return Response.json({ error: "This slicer connection requires an active Premium plan." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const fileName = String(body.fileName ?? "").trim().slice(0, 180);
  const slicer = String(body.slicer ?? connection.slicer_type).trim().slice(0, 60);
  const printerName = String(body.printerName ?? "").trim().slice(0, 100);
  const durationSeconds = numberInRange(body.durationSeconds, 60 * 60 * 24 * 365);
  const filamentGrams = numberInRange(body.filamentGrams, 1_000_000);
  const wasteGrams = numberInRange(body.wasteGrams, 1_000_000);
  if (!fileName || durationSeconds === null || filamentGrams === null || wasteGrams === null ||
      (durationSeconds === 0 && filamentGrams === 0 && wasteGrams === 0)) {
    return Response.json({ error: "No usable print time or filament metadata was found." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const payload = { fileName, slicer, printerName, durationSeconds, filamentGrams, wasteGrams };
  await db.batch([
    db.prepare(`
      INSERT INTO slicer_imports
        (id, owner_id, connection_id, file_name, slicer, printer_name, duration_seconds,
         filament_grams, waste_grams, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, connection.owner_id, connection.id, fileName, slicer, printerName,
      Math.round(durationSeconds), filamentGrams, wasteGrams, JSON.stringify(payload), now),
    db.prepare("UPDATE slicer_connections SET last_seen_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, connection.id),
  ]);
  return Response.json({ ok: true, importId: id }, { status: 201 });
}
