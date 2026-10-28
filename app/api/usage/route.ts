import { getD1 } from "@/db/filaments";
import { mapUsage } from "@/db/usage";
import { getSupabaseUser } from "@/lib/supabase/server-auth";
import { readUsageEntries } from "@/lib/usage-entries";

type SpoolRow = { id: string; name: string; remaining_weight_grams: number };

export async function GET(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to view your records." }, { status: 401 });
  const result = await getD1().prepare(`
    SELECT u.*, f.name AS filament_name
    FROM filament_usage u
    JOIN filaments f ON f.id = u.filament_id AND f.owner_id = u.owner_id
    WHERE u.owner_id = ?
    ORDER BY u.created_at DESC
  `).bind(user.id).all();
  return Response.json({ usage: result.results.map((row) => mapUsage(row)) });
}

export async function POST(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to record usage." }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const partName = String(body.partName ?? "").trim().slice(0, 100);
  const deducted = body.deducted !== false;
  const totals = readUsageEntries(body);
  if (!partName || !totals) {
    return Response.json({ error: "Enter a part name and a valid weight for every spool." }, { status: 400 });
  }

  const db = getD1();
  const filamentIds = [...totals.keys()];
  const spools = await db.prepare(`
    SELECT id, name, remaining_weight_grams FROM filaments
    WHERE owner_id = ? AND id IN (${filamentIds.map(() => "?").join(", ")})
  `).bind(user.id, ...filamentIds).all<SpoolRow>();
  if (spools.results.length !== filamentIds.length) {
    return Response.json({ error: "One of these filaments could not be found." }, { status: 404 });
  }

  if (deducted) {
    const short = spools.results.find((spool) => (totals.get(spool.id) ?? 0) > Number(spool.remaining_weight_grams));
    if (short) {
      return Response.json({
        error: `Only ${Number(short.remaining_weight_grams).toLocaleString()}g remains on ${short.name}.`,
      }, { status: 400 });
    }
  }

  const createdAt = new Date().toISOString();
  const usage = spools.results.map((spool) => ({
    id: crypto.randomUUID(),
    filamentId: spool.id,
    filamentName: spool.name,
    partName,
    gramsUsed: totals.get(spool.id) ?? 0,
    deducted,
    createdAt,
  }));

  const statements = usage.map((record) => db.prepare(`
    INSERT INTO filament_usage (id, owner_id, filament_id, part_name, grams_used, deducted, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(record.id, user.id, record.filamentId, record.partName, record.gramsUsed, record.deducted ? 1 : 0, record.createdAt));

  if (deducted) {
    for (const record of usage) {
      statements.push(db.prepare("UPDATE filaments SET remaining_weight_grams = remaining_weight_grams - ? WHERE id = ? AND owner_id = ?")
        .bind(record.gramsUsed, record.filamentId, user.id));
    }
  }
  try {
    // The negative-balance trigger in migration 0005 makes this whole batch
    // fail atomically if another request consumes the same stock first.
    await db.batch(statements);
  } catch (error) {
    if (error instanceof Error && error.message.includes("INSUFFICIENT_FILAMENT")) {
      return Response.json({
        error: "The available weight changed while this record was being saved. Review the spool totals and try again.",
      }, { status: 409 });
    }
    throw error;
  }

  const remaining: Record<string, number> = {};
  const updatedSpools = await db.prepare(`
    SELECT id, remaining_weight_grams FROM filaments
    WHERE owner_id = ? AND id IN (${filamentIds.map(() => "?").join(", ")})
  `).bind(user.id, ...filamentIds).all<{ id: string; remaining_weight_grams: number }>();
  for (const spool of updatedSpools.results) {
    remaining[spool.id] = Number(spool.remaining_weight_grams);
  }
  return Response.json({ usage, remaining }, { status: 201 });
}
