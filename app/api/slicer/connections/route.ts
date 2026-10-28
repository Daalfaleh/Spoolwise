import { getD1 } from "@/db/filaments";
import { createSlicerToken, ensureSlicerTables, hashSlicerToken, listSlicerConnections } from "@/db/slicer";
import { requirePremiumUser } from "@/lib/subscriptions/server";

const slicerTypes = new Set(["PrusaSlicer", "OrcaSlicer", "Bambu Studio", "UltiMaker Cura", "Other"]);

function setupDetails(request: Request, token: string) {
  const origin = new URL(request.url).origin;
  const endpoint = `${origin}/api/slicer/ingest`;
  const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\Spoolwise\\spoolwise-slicer-bridge.ps1" -Endpoint "${endpoint}" -Token "${token}"`;
  return { endpoint, token, command, bridgeUrl: `${origin}/api/slicer/bridge` };
}

export async function GET(request: Request) {
  const auth = await requirePremiumUser(request, "slicer connections");
  if (auth.response) return auth.response;
  return Response.json({ connections: await listSlicerConnections(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requirePremiumUser(request, "slicer connections");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 80);
  const slicerType = String(body.slicerType ?? "");
  if (!name || !slicerTypes.has(slicerType)) return Response.json({ error: "Choose a connection name and slicer." }, { status: 400 });
  await ensureSlicerTables();
  const db = getD1();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM slicer_connections WHERE owner_id = ?")
    .bind(auth.user.id).first<{ count: number }>();
  if (Number(count?.count ?? 0) >= 10) return Response.json({ error: "You can save up to 10 slicer connections." }, { status: 409 });
  const token = createSlicerToken();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO slicer_connections
      (id, owner_id, name, slicer_type, token_hash, token_prefix, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(id, auth.user.id, name, slicerType, await hashSlicerToken(token), token.slice(0, 14), now, now).run();
  const connection = (await listSlicerConnections(auth.user.id)).find((item) => item.id === id);
  return Response.json({ connection, setup: setupDetails(request, token) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requirePremiumUser(request, "slicer connections");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "A connection id is required." }, { status: 400 });
  const token = createSlicerToken();
  const result = await getD1().prepare(`
    UPDATE slicer_connections
    SET token_hash = ?, token_prefix = ?, active = 1, updated_at = ?
    WHERE id = ? AND owner_id = ?
  `).bind(await hashSlicerToken(token), token.slice(0, 14), new Date().toISOString(), id, auth.user.id).run();
  if (!result.meta.changes) return Response.json({ error: "Slicer connection not found." }, { status: 404 });
  return Response.json({ setup: setupDetails(request, token) });
}

export async function DELETE(request: Request) {
  const auth = await requirePremiumUser(request, "slicer connections");
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "A connection id is required." }, { status: 400 });
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM slicer_imports WHERE connection_id = ? AND owner_id = ?").bind(id, auth.user.id),
    db.prepare("DELETE FROM slicer_connections WHERE id = ? AND owner_id = ?").bind(id, auth.user.id),
  ]);
  return Response.json({ ok: true });
}
