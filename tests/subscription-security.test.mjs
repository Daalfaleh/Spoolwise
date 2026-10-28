import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("payment activation verifies the provider response instead of trusting the browser", async () => {
  const [callback, webhook, payment] = await Promise.all([
    read("app/api/subscribe/callback/route.ts"),
    read("app/api/webhooks/payment/route.ts"),
    read("lib/payments/moyasar.ts"),
  ]);
  assert.match(callback, /fetchMoyasarPayment\(paymentId\)/);
  assert.match(callback, /verifyMoyasarPayment\(payment, order\)/);
  assert.match(webhook, /fetchMoyasarPayment\(paymentId\)/);
  assert.match(webhook, /secureStringEqual/);
  assert.match(payment, /payment\.amount === order\.amountHalalas/);
  assert.match(payment, /payment\.currency === order\.currency/);
  assert.match(payment, /spoolwise_order_id/);
});

test("subscription secrets remain server-side and tokens are encrypted", async () => {
  const [client, server] = await Promise.all([
    read("components/UpgradeModal.tsx"),
    read("lib/payments/moyasar.ts"),
  ]);
  assert.doesNotMatch(client, /MOYASAR_SECRET_KEY|SUBSCRIPTION_TOKEN_KEY|MOYASAR_WEBHOOK_SECRET/);
  assert.match(server, /AES-GCM/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /cloudflare:workers/);
});

test("free spool cap is enforced atomically by D1", async () => {
  const route = await read("app/api/filaments/route.ts");
  assert.match(route, /FREE_SPOOL_LIMIT/);
  assert.match(route, /SELECT COUNT\(\*\) FROM filaments WHERE owner_id = \?/);
  assert.match(route, /< 5/);
});

test("premium files are parsed locally and never posted by the calculator", async () => {
  const [calculator, parser] = await Promise.all([
    read("app/SpoolwiseApp.tsx"),
    read("utils/gcodeParser.js"),
  ]);
  assert.match(calculator, /parsePrintFile\(file\)/);
  assert.doesNotMatch(parser, /fetch\s*\(/);
  assert.doesNotMatch(parser, /XMLHttpRequest/);
  assert.match(calculator, /files are never uploaded/);
});
