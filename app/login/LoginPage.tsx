"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { applyDocumentLanguage, formatGrams, formatMoney, storedLanguage } from "@/lib/i18n";

const copy = {
  en: {
    languageLabel: "Choose language",
    featuresLabel: "Spoolwise features",
    accountAction: "Account action",
    eyebrow: "3D PRINT COSTING WORKBENCH",
    title: "Make every gram",
    titleAccent: "make sense.",
    intro: "A calmer way to manage filament, record what you use, and price every print with confidence.",
    privateInventory: "Private inventory",
    liveCosting: "Live costing",
    usageRecords: "Usage records",
    cardEyebrow: "YOUR PRIVATE WORKBENCH",
    cardTitle: "Welcome to Spoolwise",
    cardBody: "Sign in or create an account to keep your spools, usage history, and pricing calculations together.",
    signIn: "Sign in",
    signUp: "Create account",
    google: "Continue with Google",
    orEmail: "or use your email",
    fullName: "Your name",
    fullNamePlaceholder: "e.g. Sara Ahmed",
    email: "Email address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Create a strong password",
    passwordRulesTitle: "Your password needs:",
    passwordLength: "10 or more characters",
    passwordUppercase: "An uppercase letter",
    passwordLowercase: "A lowercase letter",
    passwordNumber: "A number",
    passwordSymbol: "A symbol",
    showPassword: "Show password",
    hidePassword: "Hide password",
    invalidEmail: "Enter a valid email address, such as you@example.com.",
    nameRequired: "Enter your name (at least 2 characters).",
    weakPassword: "Your password does not meet every requirement below.",
    submitIn: "Sign in with email",
    submitUp: "Create account with email",
    working: "Please wait…",
    checkEmail: "Check your email to confirm your account, then return here to sign in.",
    verificationTitle: "Verify your email",
    verificationBody: "We sent a verification link to",
    verificationInstructions: "Open that email and select the confirmation link. You will then be signed in and can start using your private inventory.",
    verificationProtected: "Your inventory stays locked until your email is verified.",
    resendVerification: "Resend verification email",
    verificationSent: "A new verification email has been sent. Please also check your spam folder.",
    useDifferentEmail: "Use a different email",
    verificationRequired: "Please verify your email before signing in.",
    sampleLabel: "SAMPLE COST",
    sampleMaterial: "Warm white PLA",
    sampleUsed: "84 g used",
    samplePrice: "Suggested price",
  },
  ar: {
    languageLabel: "اختيار اللغة",
    featuresLabel: "مزايا Spoolwise",
    accountAction: "إجراء الحساب",
    eyebrow: "مساحة عمل لتسعير الطباعة ثلاثية الأبعاد",
    title: "اجعل لكل جرام",
    titleAccent: "قيمة واضحة.",
    intro: "طريقة أبسط لإدارة الخيوط وتسجيل ما تستخدمه وتسعير كل طبعة بثقة.",
    privateInventory: "مخزون خاص",
    liveCosting: "حساب فوري",
    usageRecords: "سجل الاستخدام",
    cardEyebrow: "مساحة عملك الخاصة",
    cardTitle: "مرحباً بك في Spoolwise",
    cardBody: "سجّل الدخول أو أنشئ حساباً للاحتفاظ بالبكرات وسجل الاستخدام وحسابات الأسعار في مكان واحد.",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    google: "المتابعة باستخدام Google",
    orEmail: "أو استخدم بريدك الإلكتروني",
    fullName: "الاسم",
    fullNamePlaceholder: "مثال: سارة أحمد",
    email: "البريد الإلكتروني",
    emailPlaceholder: "you@example.com",
    password: "كلمة المرور",
    passwordPlaceholder: "أنشئ كلمة مرور قوية",
    passwordRulesTitle: "يجب أن تحتوي كلمة المرور على:",
    passwordLength: "10 أحرف أو أكثر",
    passwordUppercase: "حرف إنجليزي كبير",
    passwordLowercase: "حرف إنجليزي صغير",
    passwordNumber: "رقم",
    passwordSymbol: "رمز خاص",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    invalidEmail: "أدخل بريداً إلكترونياً صالحاً، مثل you@example.com.",
    nameRequired: "أدخل اسمك (حرفان على الأقل).",
    weakPassword: "كلمة المرور لا تستوفي جميع المتطلبات أدناه.",
    submitIn: "تسجيل الدخول بالبريد الإلكتروني",
    submitUp: "إنشاء حساب بالبريد الإلكتروني",
    working: "يرجى الانتظار…",
    checkEmail: "تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم عد لتسجيل الدخول.",
    verificationTitle: "تحقق من بريدك الإلكتروني",
    verificationBody: "أرسلنا رابط التحقق إلى",
    verificationInstructions: "افتح الرسالة واضغط على رابط التأكيد. بعدها سيتم تسجيل دخولك ويمكنك البدء باستخدام مخزونك الخاص.",
    verificationProtected: "سيبقى مخزونك مقفلاً حتى يتم التحقق من بريدك الإلكتروني.",
    resendVerification: "إعادة إرسال رسالة التحقق",
    verificationSent: "تم إرسال رسالة تحقق جديدة. تحقق أيضاً من مجلد الرسائل غير المرغوب فيها.",
    useDifferentEmail: "استخدام بريد إلكتروني مختلف",
    verificationRequired: "يرجى التحقق من بريدك الإلكتروني قبل تسجيل الدخول.",
    sampleLabel: "تكلفة نموذجية",
    sampleMaterial: "PLA أبيض دافئ",
    sampleUsed: "تم استخدام 84 جم",
    samplePrice: "السعر المقترح",
  },
};

const PASSWORD_MIN_LENGTH = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function isValidEmailAddress(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

function getPasswordChecks(value: string) {
  return {
    length: value.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /\d/.test(value),
    symbol: /[^A-Za-z0-9\s]/.test(value),
  };
}

export default function LoginPage() {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [languageReady, setLanguageReady] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKey, setMessageKey] = useState<"invalidEmail" | "nameRequired" | "weakPassword" | "verificationRequired" | "">("");
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [showPasswordErrors, setShowPasswordErrors] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = storedLanguage() ?? "en";
    applyDocumentLanguage(saved);
    const frame = window.requestAnimationFrame(() => {
      setLanguage(saved);
      setLanguageReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (new URL(window.location.href).searchParams.get("verification") === "required") {
      queueMicrotask(() => setMessageKey("verificationRequired"));
    }
  }, []);

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user.email_confirmed_at) {
          window.location.replace("/app");
        } else if (data.session) {
          const pendingEmail = data.session.user.email ?? "";
          void supabase.auth.signOut().then(() => {
            setVerificationEmail(pendingEmail);
            setEmail(pendingEmail);
          });
        }
      });
    } catch (error) {
      const configurationMessage = error instanceof Error ? error.message : "Authentication is unavailable.";
      queueMicrotask(() => {
        setMessageKey("");
        setMessage(configurationMessage);
      });
    }
  }, []);

  function clearMessage() {
    setMessage("");
    setMessageKey("");
  }

  function changeLanguage(next: "en" | "ar") {
    setLanguage(next);
    window.localStorage.setItem("spoolwise-language", next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  }

  function changeMode(next: "sign-in" | "sign-up") {
    setMode(next);
    clearMessage();
    setNameTouched(false);
    setEmailTouched(false);
    setShowPasswordErrors(false);
    setShowPassword(false);
    setPassword("");
  }

  function moveAuthTab(event: ReactKeyboardEvent<HTMLButtonElement>, current: "sign-in" | "sign-up") {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home"
      ? "sign-in"
      : event.key === "End"
        ? "sign-up"
        : current === "sign-in" ? "sign-up" : "sign-in";
    changeMode(next);
    window.requestAnimationFrame(() => document.getElementById(`auth-tab-${next}`)?.focus());
  }

  async function continueWithGoogle() {
    setBusy(true);
    clearMessage();
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sign in could not start.");
      setBusy(false);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const passwordChecks = getPasswordChecks(password);
    const passwordIsStrong = Object.values(passwordChecks).every(Boolean);

    setEmailTouched(true);
    setNameTouched(mode === "sign-up");
    setShowPasswordErrors(mode === "sign-up");
    clearMessage();

    if (!isValidEmailAddress(normalizedEmail)) {
      setMessageKey("invalidEmail");
      window.requestAnimationFrame(() => emailInputRef.current?.focus());
      return;
    }
    if (mode === "sign-up" && fullName.trim().length < 2) {
      setMessageKey("nameRequired");
      window.requestAnimationFrame(() => nameInputRef.current?.focus());
      return;
    }
    if (mode === "sign-up" && !passwordIsStrong) {
      setMessageKey("weakPassword");
      window.requestAnimationFrame(() => passwordInputRef.current?.focus());
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session?.user.email_confirmed_at) window.location.replace("/app");
        else {
          setVerificationEmail(normalizedEmail);
          setResendMessage("");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setVerificationEmail(normalizedEmail);
          return;
        }
        window.location.replace("/app");
      }
    } catch (error) {
      const authError = error as Error & { code?: string };
      if (authError.code === "email_not_confirmed" || /email not confirmed/i.test(authError.message ?? "")) {
        setVerificationEmail(normalizedEmail);
      } else if (authError.code === "weak_password") {
        setShowPasswordErrors(true);
        setMessageKey("weakPassword");
        window.requestAnimationFrame(() => passwordInputRef.current?.focus());
      } else {
        setMessageKey("");
        setMessage(authError.message || "Authentication failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!verificationEmail) return;
    setBusy(true);
    setResendMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verificationEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setResendMessage(copy[language].verificationSent);
    } catch (error) {
      setResendMessage(error instanceof Error ? error.message : "The verification email could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const isArabic = language === "ar";
  const text = copy[language];
  const displayedMessage = messageKey ? text[messageKey] : message;
  const nameIsInvalid = mode === "sign-up" && nameTouched && fullName.trim().length < 2;
  const emailIsInvalid = emailTouched && !isValidEmailAddress(email);
  const passwordChecks = getPasswordChecks(password);
  const passwordIsStrong = Object.values(passwordChecks).every(Boolean);
  const passwordRules = [
    ["length", text.passwordLength],
    ["uppercase", text.passwordUppercase],
    ["lowercase", text.passwordLowercase],
    ["number", text.passwordNumber],
    ["symbol", text.passwordSymbol],
  ] as const;

  if (!languageReady) {
    return <main className="auth-loading"><span className="brand-mark" aria-hidden="true"><span /></span><p>{"\u00a0"}</p></main>;
  }

  return (
    <main className="login-page" dir={isArabic ? "rtl" : "ltr"} lang={language}>
      <header className="login-topbar">
        <a className="brand login-brand" href="/login" aria-label={isArabic ? "سبول وايز" : "Spoolwise"}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-word">{isArabic ? "سبول وايز" : "spoolwise"}</span>
        </a>
        <button className="language-toggle" type="button" aria-label={text.languageLabel} onClick={() => changeLanguage(isArabic ? "en" : "ar")}>
          <span aria-hidden="true">◎</span>{isArabic ? "English" : "العربية"}
        </button>
      </header>

      <section className="login-shell">
        <div className="login-story">
          <div className="login-copy">
            <p className="eyebrow">{text.eyebrow}</p>
            <h1>{text.title}<br /><em>{text.titleAccent}</em></h1>
            <p>{text.intro}</p>
          </div>
          <div className="login-benefits" aria-label={text.featuresLabel}>
            <span><i aria-hidden="true">01</i>{text.privateInventory}</span>
            <span><i aria-hidden="true">02</i>{text.liveCosting}</span>
            <span><i aria-hidden="true">03</i>{text.usageRecords}</span>
          </div>
          <div className="login-art" aria-hidden="true">
            <div className="art-spool"><span /></div><div className="art-line" />
            <div className="art-receipt"><small>{text.sampleLabel}</small><strong>{text.sampleMaterial}</strong><span>{language === "ar" ? `${formatGrams(84, language)} مستخدم` : `${formatGrams(84, language)} used`}</span><div><span>{text.samplePrice}</span><b>{formatMoney(31.2, "SAR", language)}</b></div></div>
          </div>
        </div>

        <div className="login-card-wrap">
          <div className="login-card auth-card">
            <span className="login-card-number" aria-hidden="true">/ 01</span>
            <p className="mini-step">{text.cardEyebrow}</p>
            <h2>{text.cardTitle}</h2>
            <p className="login-card-copy">{text.cardBody}</p>

            {verificationEmail ? (
              <div className="verification-step" role="status">
                <span className="verification-icon" aria-hidden="true">✓</span>
                <h3>{text.verificationTitle}</h3>
                <p>{text.verificationBody}</p>
                <strong className="verification-email" dir="ltr">{verificationEmail}</strong>
                <p>{text.verificationInstructions}</p>
                <small>{text.verificationProtected}</small>
                <div className="verification-actions">
                  <button className="login-button" type="button" disabled={busy} onClick={resendVerification}>
                    <span>{busy ? text.working : text.resendVerification}</span><b aria-hidden="true">↻</b>
                  </button>
                  <button className="secondary-auth-button" type="button" disabled={busy} onClick={() => { setVerificationEmail(""); setResendMessage(""); setMessage(""); setPassword(""); }}>
                    {text.useDifferentEmail}
                  </button>
                </div>
                {resendMessage && <p className="auth-message" role="status">{resendMessage}</p>}
              </div>
            ) : (
              <>
                <div className="auth-mode-tabs" role="tablist" aria-label={text.accountAction}>
                  <button id="auth-tab-sign-in" className={mode === "sign-in" ? "active" : ""} type="button" role="tab" aria-controls="auth-method-panel" aria-selected={mode === "sign-in"} tabIndex={mode === "sign-in" ? 0 : -1} onKeyDown={(event) => moveAuthTab(event, "sign-in")} onClick={() => changeMode("sign-in")}>{text.signIn}</button>
                  <button id="auth-tab-sign-up" className={mode === "sign-up" ? "active" : ""} type="button" role="tab" aria-controls="auth-method-panel" aria-selected={mode === "sign-up"} tabIndex={mode === "sign-up" ? 0 : -1} onKeyDown={(event) => moveAuthTab(event, "sign-up")} onClick={() => changeMode("sign-up")}>{text.signUp}</button>
                </div>

                <div id="auth-method-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
                <button className="google-auth-button" type="button" disabled={busy} onClick={continueWithGoogle}>
                  <svg className="google-logo" aria-hidden="true" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.715v2.258h2.909C16.66 14.25 17.64 11.927 17.64 9.205Z" />
                    <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.182l-2.909-2.258c-.806.54-1.835.86-3.048.86-2.344 0-4.328-1.585-5.037-3.715H.957v2.332A9 9 0 0 0 9 18Z" />
                    <path fill="#FBBC05" d="M3.963 10.705A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.705V4.963H.957A9 9 0 0 0 0 9c0 1.45.347 2.822.957 4.037l3.006-2.332Z" />
                    <path fill="#EA4335" d="M9 3.58c1.322 0 2.508.454 3.441 1.345l2.582-2.582C13.464.89 11.426 0 9 0A9 9 0 0 0 .957 4.963l3.006 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
                  </svg>
                  <span>{text.google}</span>
                </button>
                <div className="login-method-heading"><span />{text.orEmail}<span /></div>

                <form className="email-auth-form" noValidate onSubmit={submitEmail}>
                  {mode === "sign-up" && <label><span>{text.fullName}</span><input ref={nameInputRef} required minLength={2} autoComplete="name" aria-invalid={nameIsInvalid} aria-describedby={nameIsInvalid ? "name-error" : undefined} placeholder={text.fullNamePlaceholder} value={fullName} onBlur={() => setNameTouched(true)} onChange={(event) => setFullName(event.target.value)} />{nameIsInvalid && <small className="field-error" id="name-error">{text.nameRequired}</small>}</label>}
                  <label>
                    <span>{text.email}</span>
                    <input ref={emailInputRef} required type="email" inputMode="email" autoComplete="email" aria-invalid={emailIsInvalid} aria-describedby={emailIsInvalid ? "email-error" : undefined} placeholder={text.emailPlaceholder} value={email} onBlur={() => setEmailTouched(true)} onChange={(event) => setEmail(event.target.value)} />
                    {emailIsInvalid && <small className="field-error" id="email-error">{text.invalidEmail}</small>}
                  </label>
                  <div className="auth-field">
                    <label htmlFor="auth-password">{text.password}</label>
                    <span className="password-field">
                      <input id="auth-password" ref={passwordInputRef} required type={showPassword ? "text" : "password"} minLength={mode === "sign-up" ? PASSWORD_MIN_LENGTH : undefined} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} aria-invalid={mode === "sign-up" && showPasswordErrors && !passwordIsStrong} aria-describedby={mode === "sign-up" ? "password-rules" : undefined} placeholder={mode === "sign-up" ? text.passwordPlaceholder : text.password} value={password} onChange={(event) => setPassword(event.target.value)} />
                      <button type="button" aria-label={showPassword ? text.hidePassword : text.showPassword} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "×" : "◎"}</button>
                    </span>
                  </div>
                  {mode === "sign-up" && (
                    <div className={`password-checklist${showPasswordErrors && !passwordIsStrong ? " has-error" : ""}`} id="password-rules" aria-live="polite">
                      <p>{text.passwordRulesTitle}</p>
                      <ul>
                        {passwordRules.map(([key, label]) => <li className={passwordChecks[key] ? "met" : ""} key={key}><span aria-hidden="true">{passwordChecks[key] ? "✓" : "○"}</span>{label}</li>)}
                      </ul>
                    </div>
                  )}
                  <button className="login-button" type="submit" disabled={busy}><span>{busy ? text.working : mode === "sign-up" ? text.submitUp : text.submitIn}</span><b aria-hidden="true">→</b></button>
                </form>
                {displayedMessage && !["invalidEmail", "nameRequired", "weakPassword"].includes(messageKey) && <p className="auth-message" role="alert">{displayedMessage}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
