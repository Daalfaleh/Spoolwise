import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("authentication controls keep keyboard, validation, and bilingual state coherent", async () => {
  const login = await read("app/login/LoginPage.tsx");

  assert.match(login, /role="tabpanel" aria-labelledby=\{`auth-tab-\$\{mode\}`\}/);
  assert.match(login, /tabIndex=\{mode === "sign-in" \? 0 : -1\}/);
  assert.match(login, /moveAuthTab\(event/);
  assert.match(login, /emailInputRef\.current\?\.focus\(\)/);
  assert.match(login, /passwordInputRef\.current\?\.focus\(\)/);
  assert.match(login, /messageKey \? text\[messageKey\] : message/);
  assert.match(login, /aria-label=\{showPassword \? text\.hidePassword : text\.showPassword\}/);
});

test("premium tabs and checkout dialog remain accessible", async () => {
  const [gate, modal] = await Promise.all([
    read("components/PremiumGate.tsx"),
    read("components/UpgradeModal.tsx"),
  ]);

  assert.match(gate, /role=\{panelId \? "tabpanel" : undefined\}/);
  assert.match(gate, /aria-labelledby=\{labelledBy\}/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /returnFocusRef\.current\?\.focus\(\)/);
});

test("narrow layouts do not crowd actions and sync state is truthful", async () => {
  const [app, css] = await Promise.all([
    read("app/SpoolwiseApp.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(app, /data-state=\{syncState\}/);
  assert.match(app, /Inventory sync needs attention/);
  assert.match(css, /@media \(max-width: 400px\)[\s\S]*\.topbar \{ flex-wrap: wrap; gap: 12px; \}/);
  assert.match(css, /\.topbar-actions \{ justify-content: space-between; width: 100%; \}/);
});
