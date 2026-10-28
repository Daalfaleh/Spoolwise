import { createClient, type User } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";

export async function getSupabaseUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const url = String(Reflect.get(env, "SUPABASE_URL") ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const publishableKey = String(
    Reflect.get(env, "SUPABASE_PUBLISHABLE_KEY") ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  );
  if (!url || !publishableKey) return null;

  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email_confirmed_at) return null;
  return data.user;
}
