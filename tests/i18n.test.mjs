import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { currencyName, formatGrams, formatMoney, formatPercent } from "../lib/i18n.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("formats Arabic currency, weight, and percentages with Arabic digits and units", () => {
  const money = formatMoney(80, "SAR", "ar");
  const weight = formatGrams(1250, "ar");
  const percent = formatPercent(45, "ar");

  assert.match(money, /[٠-٩]/);
  assert.doesNotMatch(money, /SAR/);
  assert.match(weight, /[٠-٩]/);
  assert.match(weight, /غ/);
  assert.match(percent, /[٠-٩]/);
  assert.match(percent, /٪/);
  assert.notEqual(currencyName("SAR", "ar"), "SAR");
});

test("preserves the selected language and gives Arabic plus actions trailing placement", async () => {
  const [app, account, css] = await Promise.all([
    read("app/SpoolwiseApp.tsx"),
    read("app/account/AccountPage.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(app, /setLanguage\(storedLanguage\(\) \?\? profileData\.profile\.language\)/);
  assert.match(account, /const preferredLanguage = storedLanguage\(\) \?\? data\.profile\.language/);
  assert.match(app, /value=\{t\(form\.color\)\}/);
  assert.match(app, /plus-action/);
  assert.match(css, /\[dir="rtl"\] \.plus-action \.plus-symbol \{ order: 1; \}/);
  assert.match(css, /\[dir="rtl"\] \.section-subtabs \.plus-tab > span \{ order: 1; \}/);
});

test("places Arabic currency controls left of amounts and localizes loading screens", async () => {
  const [css, authenticatedApp, callback, languageHook] = await Promise.all([
    read("app/globals.css"),
    read("app/app/AuthenticatedApp.tsx"),
    read("app/auth/callback/page.tsx"),
    read("lib/use-language-preference.ts"),
  ]);

  assert.match(css, /\[dir="rtl"\] \.cost-input \{ direction: ltr; \}/);
  assert.match(css, /\[dir="rtl"\] \.cost-input select \{ direction: rtl;/);
  assert.match(css, /\[dir="rtl"\] \.cost-input input \{ direction: ltr; text-align: right; \}/);
  assert.match(authenticatedApp, /جارٍ تحميل مساحة العمل/);
  assert.match(callback, /جارٍ إكمال تسجيل الدخول الآمن/);
  assert.match(authenticatedApp, /useLanguagePreference\(\)/);
  assert.match(callback, /useLanguagePreference\(\)/);
  assert.match(languageHook, /storedLanguage\(\) \?\? "en"/);
});

test("localizes the Spoolwise brand lockup and keeps its mark on the RTL leading side", async () => {
  const [app, login, account, css] = await Promise.all([
    read("app/SpoolwiseApp.tsx"),
    read("app/login/LoginPage.tsx"),
    read("app/account/AccountPage.tsx"),
    read("app/globals.css"),
  ]);

  for (const screen of [app, login, account]) {
    assert.match(screen, /isArabic \? "سبول وايز" : "spoolwise"/);
    assert.match(screen, /className="brand-word"/);
  }
  assert.match(css, /\[dir="rtl"\] \.brand > \.brand-mark \{ order: -1; \}/);
  assert.match(css, /\[dir="rtl"\] \.brand > \.brand-word/);
});
