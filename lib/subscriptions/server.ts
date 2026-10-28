import { getUserTier } from "@/db/subscription";
import { getSupabaseUser } from "@/lib/supabase/server-auth";

type PremiumResult =
  | { user: NonNullable<Awaited<ReturnType<typeof getSupabaseUser>>>; response?: never }
  | { user?: never; response: Response };

export async function requirePremiumUser(request: Request, feature = "this feature"): Promise<PremiumResult> {
  const user = await getSupabaseUser(request);
  if (!user) {
    return { response: Response.json({ error: "Sign in to continue." }, { status: 401 }) };
  }
  const tier = await getUserTier(user.id);
  if (tier.tier !== "premium") {
    return {
      response: Response.json({
        code: "PREMIUM_REQUIRED",
        error: `Spoolwise Premium is required to use ${feature}.`,
      }, { status: 403 }),
    };
  }
  return { user };
}
