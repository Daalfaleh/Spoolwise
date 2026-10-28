import { getD1 } from "@/db/filaments";
import { ensureProfilesTable, mapProfile, supportedCurrencySet } from "@/db/profile";
import { getSupabaseUser } from "@/lib/supabase/server-auth";

function fallbackName(metadata: Record<string, unknown> | undefined, email: string) {
  return String(metadata?.full_name ?? metadata?.name ?? email ?? "").trim();
}

export async function GET(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to view your account." }, { status: 401 });

  await ensureProfilesTable();
  const row = await getD1().prepare("SELECT * FROM profiles WHERE owner_id = ?").bind(user.id)
    .first<Record<string, unknown>>();
  return Response.json({
    profile: mapProfile(row ?? null, fallbackName(user.user_metadata, user.email ?? "")),
    email: user.email ?? "",
  });
}

export async function PATCH(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to update your account." }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const displayName = String(body.displayName ?? "").trim().slice(0, 80);
  const country = String(body.country ?? "").trim().toUpperCase().slice(0, 2);
  const preferredCurrency = String(body.preferredCurrency ?? "");
  const language = String(body.language ?? "en") === "ar" ? "ar" : "en";

  if (displayName.length < 2) {
    return Response.json({ error: "Enter a name with at least 2 characters." }, { status: 400 });
  }
  if (country && !/^[A-Z]{2}$/.test(country)) {
    return Response.json({ error: "Choose a country from the list." }, { status: 400 });
  }
  if (!supportedCurrencySet.has(preferredCurrency)) {
    return Response.json({ error: "Choose a supported currency." }, { status: 400 });
  }

  await ensureProfilesTable();
  await getD1().prepare(`
    INSERT INTO profiles (owner_id, display_name, country, preferred_currency, language, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET
      display_name = excluded.display_name,
      country = excluded.country,
      preferred_currency = excluded.preferred_currency,
      language = excluded.language,
      updated_at = excluded.updated_at
  `).bind(user.id, displayName, country, preferredCurrency, language, new Date().toISOString()).run();

  return Response.json({ profile: { displayName, country, preferredCurrency, language } });
}
