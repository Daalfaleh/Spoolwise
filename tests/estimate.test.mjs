import assert from "node:assert/strict";
import test from "node:test";
import { estimateReference, usesMixedCurrencies } from "../lib/estimate.js";

const baseEstimate = {
  items: [{ id: "spool-a", grams: 125, purchaseCost: 80, spoolWeightGrams: 1000, currency: "SAR" }],
  extraCosts: 3.5,
  profitPercent: 45,
  currency: "SAR",
};

test("blocks totals that combine different currencies", () => {
  assert.equal(usesMixedCurrencies(["SAR", "USD"]), true);
  assert.equal(usesMixedCurrencies(["SAR", "SAR"]), false);
  assert.equal(usesMixedCurrencies([]), false);
});

test("receipt reference changes with every material estimate input", () => {
  const original = estimateReference(baseEstimate);
  assert.notEqual(original, estimateReference({ ...baseEstimate, extraCosts: 4 }));
  assert.notEqual(original, estimateReference({ ...baseEstimate, profitPercent: 50 }));
  assert.notEqual(original, estimateReference({ ...baseEstimate, currency: "AED" }));
  assert.notEqual(original, estimateReference({ ...baseEstimate, items: [{ ...baseEstimate.items[0], grams: 126 }] }));
  assert.notEqual(original, estimateReference({ ...baseEstimate, items: [{ ...baseEstimate.items[0], purchaseCost: 85 }] }));
  assert.equal(original, estimateReference({ ...baseEstimate }));
});
