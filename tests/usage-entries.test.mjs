import assert from "node:assert/strict";
import test from "node:test";
import { MAX_USAGE_ENTRIES, readUsageEntries } from "../lib/usage-entries.js";

test("combines duplicate spool rows into one deduction", () => {
  const entries = readUsageEntries({
    entries: [
      { filamentId: "spool-a", gramsUsed: 20 },
      { filamentId: "spool-b", gramsUsed: 15 },
      { filamentId: "spool-a", gramsUsed: 5 },
    ],
  });

  assert.ok(entries);
  assert.deepEqual([...entries], [["spool-a", 25], ["spool-b", 15]]);
});

test("rejects requests that exceed the supported row limit", () => {
  const entries = Array.from({ length: MAX_USAGE_ENTRIES + 1 }, (_, index) => ({
    filamentId: `spool-${index}`,
    gramsUsed: 1,
  }));

  assert.equal(readUsageEntries({ entries }), null);
});

test("rejects malformed or excessive deductions", () => {
  assert.equal(readUsageEntries({ entries: [] }), null);
  assert.equal(readUsageEntries({ entries: [null] }), null);
  assert.equal(readUsageEntries({ entries: [{ filamentId: "spool-a", gramsUsed: 100001 }] }), null);
  assert.equal(readUsageEntries({ entries: [{ filamentId: "spool-a", gramsUsed: 0 }] }), null);
});
