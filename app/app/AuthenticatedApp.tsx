"use client";

import { useEffect } from "react";
import SpoolwiseApp from "../SpoolwiseApp";
import { sessionDisplayName, signOutToLogin, useSupabaseSession } from "@/lib/supabase/use-session";
import { useLanguagePreference } from "@/lib/use-language-preference";

const loadingCopy = {
  en: {
    loading: "Loading your workbench…",
    setup: "Spoolwise authentication needs setup",
    return: "Return to sign in",
  },
  ar: {
    loading: "جارٍ تحميل مساحة العمل…",
    setup: "يحتاج تسجيل الدخول إلى Spoolwise إلى إعداد",
    return: "العودة إلى تسجيل الدخول",
  },
};

export default function AuthenticatedApp() {
  const { session, loading, configurationError } = useSupabaseSession();
  const { language, ready: languageReady } = useLanguagePreference();
  const text = loadingCopy[language];

  useEffect(() => {
    if (!session?.access_token) return;
    void fetch("/api/welcome", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {
      // Welcome delivery must never block access to the workbench. Failed claims remain retryable.
    });
  }, [session?.access_token]);

  if (!languageReady) {
    return <main className="auth-loading"><span className="brand-mark" aria-hidden="true"><span /></span><p>{"\u00a0"}</p></main>;
  }

  if (loading) {
    return <main className="auth-loading" dir={language === "ar" ? "rtl" : "ltr"} lang={language}><span className="brand-mark" aria-hidden="true"><span /></span><p>{text.loading}</p></main>;
  }

  if (configurationError || !session) {
    return <main className="auth-loading" dir={language === "ar" ? "rtl" : "ltr"} lang={language}><strong>{text.setup}</strong><p>{configurationError}</p><a href="/login">{text.return}</a></main>;
  }

  return (
    <SpoolwiseApp
      accessToken={session.access_token}
      initialLanguage={language}
      user={{ displayName: sessionDisplayName(session), email: session.user.email ?? "" }}
      onSignOut={signOutToLogin}
    />
  );
}
