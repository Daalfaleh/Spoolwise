import { getD1 } from "./filaments";

export type ProfileRecord = {
  displayName: string;
  country: string;
  preferredCurrency: string;
  language: string;
};

/** Currencies the app can price in. Kept in sync with `currencyOptions` in the client. */
export const supportedCurrencies = [
  "SAR", "AED", "BHD", "EGP", "JOD", "KWD", "OMR", "QAR",
  "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NZD",
  "TRY", "INR", "PKR", "JPY", "CNY", "MAD", "ZAR",
];

export const supportedCurrencySet = new Set(supportedCurrencies);

const createProfilesTableSql = `
  CREATE TABLE IF NOT EXISTS profiles (
    owner_id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    preferred_currency TEXT NOT NULL DEFAULT 'SAR',
    language TEXT NOT NULL DEFAULT 'en',
    updated_at TEXT NOT NULL
  )
`;

/** Safety net so accounts work on databases where migration 0004 has not been applied yet. */
export async function ensureProfilesTable() {
  await getD1().prepare(createProfilesTableSql).run();
}

export function mapProfile(row: Record<string, unknown> | null, fallbackName: string): ProfileRecord {
  const currency = String(row?.preferred_currency ?? "");
  const language = String(row?.language ?? "");
  return {
    displayName: String(row?.display_name ?? "") || fallbackName,
    country: String(row?.country ?? ""),
    preferredCurrency: supportedCurrencySet.has(currency) ? currency : "SAR",
    language: language === "ar" ? "ar" : "en",
  };
}
