/**
 * @param {string[]} currencies
 */
export function usesMixedCurrencies(currencies) {
  return new Set(currencies.filter(Boolean)).size > 1;
}

/**
 * Produce a stable reference for every value that materially changes an
 * estimate. This is an identifier, not a security token.
 *
 * @param {{ items: Array<{ id: string, grams: number, purchaseCost?: number, spoolWeightGrams?: number, currency?: string }>, extraCosts: number, profitPercent: number, currency: string }} estimate
 */
export function estimateReference(estimate) {
  const source = JSON.stringify({
    items: estimate.items,
    extraCosts: Number.isFinite(estimate.extraCosts) ? estimate.extraCosts : 0,
    profitPercent: Number.isFinite(estimate.profitPercent) ? estimate.profitPercent : 0,
    currency: estimate.currency,
  });

  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}
