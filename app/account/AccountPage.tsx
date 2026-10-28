"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { applyDocumentLanguage, currencyName, storedLanguage } from "@/lib/i18n";
import {
  sessionDisplayName,
  signOutToLogin,
  updateAccountName,
  useSupabaseSession,
} from "@/lib/supabase/use-session";

type Profile = {
  displayName: string;
  country: string;
  preferredCurrency: string;
  language: "en" | "ar";
};

/** Kept in sync with `supportedCurrencies` in db/profile.ts. */
const currencyOptions = [
  "SAR", "AED", "BHD", "EGP", "JOD", "KWD", "OMR", "QAR",
  "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NZD",
  "TRY", "INR", "PKR", "JPY", "CNY", "MAD", "ZAR",
];

const countryCodes = [
  "AE", "AF", "AL", "AR", "AT", "AU", "AZ", "BA", "BD", "BE", "BG", "BH", "BR", "CA", "CH", "CL",
  "CN", "CO", "CY", "CZ", "DE", "DK", "DZ", "EE", "EG", "ES", "ET", "FI", "FR", "GB", "GE", "GH",
  "GR", "HK", "HR", "HU", "ID", "IE", "IL", "IN", "IQ", "IR", "IS", "IT", "JO", "JP", "KE", "KG",
  "KH", "KR", "KW", "KZ", "LB", "LK", "LT", "LU", "LV", "LY", "MA", "MT", "MX", "MY", "NG", "NL",
  "NO", "NP", "NZ", "OM", "PE", "PH", "PK", "PL", "PS", "PT", "QA", "RO", "RS", "RU", "SA", "SD",
  "SE", "SG", "SI", "SK", "SN", "SO", "SY", "TH", "TN", "TR", "TW", "TZ", "UA", "UG", "US", "UY",
  "UZ", "VN", "YE", "ZA",
];

const copy = {
  en: {
    languageLabel: "Choose language",
    back: "Back to workbench",
    eyebrow: "ACCOUNT",
    title: "Your account,",
    titleAccent: "your preferences.",
    intro: "Update the name on your workbench, where you print from, and the currency every price is shown in.",
    heading: "Account settings",
    step: "PROFILE & PREFERENCES",
    displayName: "Display name",
    displayNameHint: "Shown on your workbench",
    email: "Email address",
    emailHint: "Your sign-in email cannot be changed here.",
    country: "Country",
    notSet: "Not set",
    currency: "Preferred currency",
    currencyHint: "Used for new spools and pricing",
    language: "Language",
    english: "English",
    arabic: "Arabic",
    save: "Save account details",
    saving: "Saving…",
    saved: "Your account details were saved.",
    signOut: "Sign out",
    loading: "Loading your account…",
    setupTitle: "Spoolwise authentication needs setup",
    returnToSignIn: "Return to sign in",
  },
  ar: {
    languageLabel: "اختيار اللغة",
    back: "العودة إلى مساحة العمل",
    eyebrow: "الحساب",
    title: "حسابك،",
    titleAccent: "وتفضيلاتك.",
    intro: "حدّث الاسم الظاهر في مساحة عملك، والدولة التي تطبع منها، والعملة التي تظهر بها كل الأسعار.",
    heading: "إعدادات الحساب",
    step: "الملف الشخصي والتفضيلات",
    displayName: "الاسم المعروض",
    displayNameHint: "يظهر في مساحة عملك",
    email: "البريد الإلكتروني",
    emailHint: "لا يمكن تغيير بريد تسجيل الدخول من هنا.",
    country: "الدولة",
    notSet: "غير محدد",
    currency: "العملة المفضلة",
    currencyHint: "تُستخدم للبكرات الجديدة والتسعير",
    language: "اللغة",
    english: "الإنجليزية",
    arabic: "العربية",
    save: "حفظ بيانات الحساب",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ بيانات حسابك.",
    signOut: "تسجيل الخروج",
    loading: "جارٍ تحميل حسابك…",
    setupTitle: "يحتاج تسجيل الدخول إلى إعداد",
    returnToSignIn: "العودة إلى تسجيل الدخول",
  },
};

export default function AccountPage() {
  const { session, loading, configurationError } = useSupabaseSession();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [languageReady, setLanguageReady] = useState(false);
  const skipInitialLanguagePersistence = useRef(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = storedLanguage();
    if (saved) {
      applyDocumentLanguage(saved);
      // Restoring the local language preference is the synchronization performed by this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguage(saved);
    }
    setLanguageReady(true);
  }, []);

  useEffect(() => {
    if (skipInitialLanguagePersistence.current) {
      skipInitialLanguagePersistence.current = false;
      return;
    }
    applyDocumentLanguage(language);
    window.localStorage.setItem("spoolwise-language", language);
  }, [language]);

  const accessToken = session?.access_token ?? "";

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error("Could not load your account details.");
        const data = (await response.json()) as { profile: Profile };
        if (cancelled) return;
        const preferredLanguage = storedLanguage() ?? data.profile.language;
        setProfile(data.profile);
        setDraft({ ...data.profile, language: preferredLanguage });
        setLanguage(preferredLanguage);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    }

    void loadProfile();
    return () => { cancelled = true; };
  }, [accessToken]);

  const isArabic = language === "ar";
  const text = copy[language];

  function changeLanguage(next: "en" | "ar") {
    setLanguage(next);
    setDraft((current) => current ? { ...current, language: next } : current);
  }

  const countries = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([language], { type: "region" });
    } catch {
      display = null;
    }
    return countryCodes
      .map((code) => ({ code, name: display?.of(code) ?? code }))
      .sort((left, right) => left.name.localeCompare(right.name, language));
  }, [language]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await response.json()) as { profile?: Profile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Could not save your account details.");
      setProfile(data.profile);
      setDraft(data.profile);
      setLanguage(data.profile.language);
      await updateAccountName(data.profile.displayName);
      setMessage(copy[data.profile.language].saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (!languageReady) {
    return <main className="auth-loading"><span className="brand-mark" aria-hidden="true"><span /></span><p>{"\u00a0"}</p></main>;
  }

  if (loading) {
    return <main className="auth-loading" dir={isArabic ? "rtl" : "ltr"} lang={language}><span className="brand-mark" aria-hidden="true"><span /></span><p>{text.loading}</p></main>;
  }

  if (configurationError || !session) {
    return (
      <main className="auth-loading">
        <strong>{text.setupTitle}</strong>
        <p>{configurationError}</p>
        <a href="/login">{text.returnToSignIn}</a>
      </main>
    );
  }

  const email = session.user.email ?? "";
  const shownName = profile?.displayName || sessionDisplayName(session);
  const initial = (shownName || email || "S").slice(0, 1).toUpperCase();
  const countryName = profile?.country
    ? (countries.find((item) => item.code === profile.country)?.name ?? profile.country)
    : text.notSet;

  return (
    <main className="account-page" dir={isArabic ? "rtl" : "ltr"} lang={language}>
      <header className="topbar">
        <a className="brand" href="/app" aria-label={isArabic ? "سبول وايز — الرئيسية" : "Spoolwise home"}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-word">{isArabic ? "سبول وايز" : "spoolwise"}</span>
        </a>
        <div className="topbar-actions">
          <a className="back-link" href="/app">
            <span aria-hidden="true">{isArabic ? "→" : "←"}</span>
            <em>{text.back}</em>
          </a>
          <button
            className="language-toggle"
            type="button"
            aria-label={text.languageLabel}
            onClick={() => changeLanguage(isArabic ? "en" : "ar")}
          >
            <span aria-hidden="true">◎</span>
            {isArabic ? "English" : "العربية"}
          </button>
        </div>
      </header>

      <section className="account-shell">
        <div className="account-intro">
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}<br /><em>{text.titleAccent}</em></h1>
          <p className="intro-copy">{text.intro}</p>
        </div>

        <div className="panel account-panel">
          <div className="panel-heading">
            <div>
              <p className="step">{text.step}</p>
              <h2>{text.heading}</h2>
            </div>
            <span className="count">{countryName}</span>
          </div>

          <div className="account-body">
            <div className="account-identity">
              <span className="account-avatar" aria-hidden="true">{initial}</span>
              <div>
                <strong>{shownName}</strong>
                <span dir="ltr">{email}</span>
              </div>
              <button className="secondary-button account-signout" type="button" onClick={() => void signOutToLogin()}>
                {text.signOut}
              </button>
            </div>

            <form className="account-form" onSubmit={saveProfile}>
              <label className="field">
                <span>{text.displayName} <small>{text.displayNameHint}</small></span>
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={draft?.displayName ?? ""}
                  disabled={!draft}
                  onChange={(event) => draft && setDraft({ ...draft, displayName: event.target.value })}
                />
              </label>
              <label className="field">
                <span>{text.email}</span>
                <input value={email} dir="ltr" readOnly disabled />
                <small className="account-hint">{text.emailHint}</small>
              </label>
              <label className="field">
                <span>{text.country}</span>
                <select
                  value={draft?.country ?? ""}
                  disabled={!draft}
                  onChange={(event) => draft && setDraft({ ...draft, country: event.target.value })}
                >
                  <option value="">{text.notSet}</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{text.currency} <small>{text.currencyHint}</small></span>
                <select
                  value={draft?.preferredCurrency ?? "SAR"}
                  disabled={!draft}
                  onChange={(event) => draft && setDraft({ ...draft, preferredCurrency: event.target.value })}
                >
                  {currencyOptions.map((option) => <option key={option} value={option}>{language === "ar" ? `${currencyName(option, language)} (${option})` : option}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{text.language}</span>
                <select
                  value={draft?.language ?? "en"}
                  disabled={!draft}
                  onChange={(event) => draft && setDraft({ ...draft, language: event.target.value === "ar" ? "ar" : "en" })}
                >
                  <option value="en">{text.english}</option>
                  <option value="ar">{text.arabic}</option>
                </select>
              </label>
              <button className="add-button field-wide" type="submit" disabled={saving || !draft}>
                <span aria-hidden="true">✓</span> {saving ? text.saving : text.save}
              </button>
            </form>
            {message && <p className="management-message" role="status">{message}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
