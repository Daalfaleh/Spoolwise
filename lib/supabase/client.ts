"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured yet.");
  }

  // `detectSessionInUrl` is off on purpose: the automatic exchange raced the explicit one on
  // /auth/callback, so whichever call lost reported "could not sign you in" even though the
  // session had already been stored. The callback page now owns the exchange.
  browserClient ??= createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
    },
  });

  return browserClient;
}
