const locales = { en: "en-GB", ar: "ar-SA" };

/** @param {"en" | "ar"} language */
export function localeFor(language) {
  return locales[language] ?? locales.en;
}

/** @returns {"en" | "ar" | null} */
export function storedLanguage() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("spoolwise-language");
  return value === "en" || value === "ar" ? value : null;
}

/** @param {"en" | "ar"} language */
export function applyDocumentLanguage(language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
}

/** @param {number} value @param {"en" | "ar"} language @param {number} [maximumFractionDigits] */
export function formatNumber(value, language, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(localeFor(language), { maximumFractionDigits }).format(Number.isFinite(value) ? value : 0);
}

/** @param {number} value @param {string} currency @param {"en" | "ar"} language */
export function formatMoney(value, currency, language) {
  return new Intl.NumberFormat(localeFor(language), {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/** @param {number} value @param {"en" | "ar"} language */
export function formatGrams(value, language) {
  return new Intl.NumberFormat(localeFor(language), {
    style: "unit",
    unit: "gram",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

/** @param {number} value @param {"en" | "ar"} language */
export function formatPercent(value, language) {
  return new Intl.NumberFormat(localeFor(language), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format((Number.isFinite(value) ? value : 0) / 100);
}

/** @param {string} currency @param {"en" | "ar"} language */
export function currencyName(currency, language) {
  try {
    return new Intl.DisplayNames([localeFor(language)], { type: "currency" }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

/** @param {string} currency @param {"en" | "ar"} language */
export function currencySymbol(currency, language) {
  try {
    return new Intl.NumberFormat(localeFor(language), {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}
