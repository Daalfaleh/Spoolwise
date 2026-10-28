"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveOAuthCallback } from "@/lib/supabase/oauth-callback";
import { storedLanguage } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/use-language-preference";

const callbackCopy = {
  en: { loading: "Completing your secure sign in…", error: "We could not complete sign in. Please return and try again.", return: "Return to sign in" },
  ar: { loading: "جارٍ إكمال تسجيل الدخول الآمن…", error: "تعذر إكمال تسجيل الدخول. يُرجى العودة والمحاولة مرة أخرى.", return: "العودة إلى تسجيل الدخول" },
};

export default function AuthCallbackPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const { language, ready: languageReady } = useLanguagePreference();
  const text = callbackCopy[language];

  useEffect(() => {
    async function completeSignIn() {
      try {
        const supabase = getSupabaseBrowserClient();
        const session = await resolveOAuthCallback(supabase, window.location.href);

        if (!session.user.email_confirmed_at) {
          await supabase.auth.signOut();
          window.location.replace("/login?verification=required");
          return;
        }
        window.location.replace("/app");
      } catch (error) {
        const message = error instanceof Error
          ? error.message.trim()
          : typeof error === "object" && error && "message" in error && typeof error.message === "string"
            ? error.message.trim()
            : "";
        const fallbackLanguage = storedLanguage() ?? "en";
        setErrorMessage(message || callbackCopy[fallbackLanguage].error);
      }
    }
    void completeSignIn();
  }, []);

  return <main className="auth-loading" dir={language === "ar" ? "rtl" : "ltr"} lang={language}><span className="brand-mark" aria-hidden="true"><span /></span><p>{languageReady ? (errorMessage || text.loading) : "\u00a0"}</p><a href="/login">{languageReady ? text.return : "\u00a0"}</a></main>;
}
