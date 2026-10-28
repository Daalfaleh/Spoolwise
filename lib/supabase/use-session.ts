"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./client";

/**
 * Shared guard for every signed-in page: resolves the Supabase session, bounces unverified or
 * signed-out visitors back to /login, and keeps following session changes while mounted.
 */
export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState("");

  useEffect(() => {
    let redirectingForVerification = false;
    try {
      const supabase = getSupabaseBrowserClient();

      function accept(nextSession: Session) {
        setSession(nextSession);
        setLoading(false);
      }

      function rejectUnverified() {
        redirectingForVerification = true;
        void supabase.auth.signOut().then(() => window.location.replace("/login?verification=required"));
      }

      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          window.location.replace("/login");
          return;
        }
        if (!data.session.user.email_confirmed_at) {
          rejectUnverified();
          return;
        }
        accept(data.session);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!nextSession) {
          if (!redirectingForVerification) window.location.replace("/login");
          return;
        }
        if (!nextSession.user.email_confirmed_at) {
          rejectUnverified();
          return;
        }
        accept(nextSession);
      });
      return () => listener.subscription.unsubscribe();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication is unavailable.";
      queueMicrotask(() => {
        setConfigurationError(message);
        setLoading(false);
      });
    }
  }, []);

  return { session, loading, configurationError };
}

export async function signOutToLogin() {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
  window.location.replace("/login");
}

export async function updateAccountName(displayName: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
  if (error) throw error;
  return data.user;
}

export function sessionDisplayName(session: Session) {
  return String(
    session.user.user_metadata?.full_name
    ?? session.user.user_metadata?.name
    ?? session.user.email
    ?? "Maker",
  );
}
