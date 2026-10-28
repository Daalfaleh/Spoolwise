export const MAX_USAGE_ENTRIES = 8;
export const MAX_USAGE_GRAMS = 100000;

/**
 * Normalize the multi-spool request body while retaining support for the
 * original single-spool body. Duplicate spool rows are combined.
 *
 * @param {Record<string, unknown>} body
 * @returns {Map<string, number> | null}
 */
export function readUsageEntries(body) {
  const raw = Array.isArray(body.entries)
    ? body.entries
    : [{ filamentId: body.filamentId, gramsUsed: body.gramsUsed }];

  // Reject oversized requests instead of silently dropping trailing rows.
  if (raw.length === 0 || raw.length > MAX_USAGE_ENTRIES) return null;

  const totals = new Map();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const entry = /** @type {Record<string, unknown>} */ (item);
    const filamentId = String(entry.filamentId ?? "");
    const gramsUsed = Number(entry.gramsUsed);
    if (!filamentId || !Number.isFinite(gramsUsed) || gramsUsed <= 0) return null;

    const total = (totals.get(filamentId) ?? 0) + gramsUsed;
    if (total > MAX_USAGE_GRAMS) return null;
    totals.set(filamentId, total);
  }

  return totals.size ? totals : null;
}
