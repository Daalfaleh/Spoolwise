import { getUserTier } from "@/db/subscription";
import { getSupabaseUser } from "@/lib/supabase/server-auth";

export async function GET(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to view your plan." }, { status: 401 });
  return Response.json(await getUserTier(user.id));
}

