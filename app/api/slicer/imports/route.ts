import { getD1 } from "@/db/filaments";
import { listSlicerImports } from "@/db/slicer";
import { requirePremiumUser } from "@/lib/subscriptions/server";

export async function GET(request: Request) {
  const auth = await requirePremiumUser(request, "slicer imports");
  if (auth.response) return auth.response;
  return Response.json({ imports: await listSlicerImports(auth.user.id) });
}

export async function DELETE(request: Request) {
  const auth = await requirePremiumUser(request, "slicer imports");
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "An import id is required." }, { status: 400 });
  const result = await getD1().prepare("DELETE FROM slicer_imports WHERE id = ? AND owner_id = ?")
    .bind(id, auth.user.id).run();
  if (!result.meta.changes) return Response.json({ error: "Slicer import not found." }, { status: 404 });
  return Response.json({ ok: true });
}
