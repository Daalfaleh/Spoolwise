import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { escapeEmailHtml, renderWelcomeEmail } from "../lib/email/templates.js";

const root = new URL("../", import.meta.url);

test("renders a branded welcome email with an escaped account name", () => {
  const message = renderWelcomeEmail({
    displayName: 'Maker <script>alert("x")</script>',
    appUrl: "https://spoolwise.example/app",
  });

  assert.match(message.subject, /Welcome to Spoolwise/);
  assert.match(message.subject, /أهلاً بك/);
  assert.match(message.html, /spoolwise/);
  assert.match(message.html, /Inventory/);
  assert.match(message.html, /Calculator/);
  assert.match(message.html, /Records/);
  assert.match(message.html, /المخزون/);
  assert.match(message.html, /الحاسبة/);
  assert.match(message.html, /السجلات/);
  assert.ok(message.html.indexOf("Welcome,") < message.html.indexOf("أهلاً بك"));
  assert.match(message.html, /https:\/\/spoolwise\.example\/app/);
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.text, /Welcome, Maker <script>/);
});

test("escapes all HTML-significant characters", () => {
  assert.equal(escapeEmailHtml(`<&>'"`), "&lt;&amp;&gt;&#39;&quot;");
});

test("confirmation template keeps Supabase's secure confirmation URL and Spoolwise branding", async () => {
  const template = await readFile(new URL("supabase/templates/confirmation.html", root), "utf8");

  assert.match(template, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(template, /\{\{ \.Email \}\}/);
  assert.match(template, /Verify your email/);
  assert.match(template, /spoolwise/);
  assert.match(template, /أكّد/);
  assert.ok(template.indexOf("Verify your email") < template.indexOf("أكّد بريدك الإلكتروني"));
});
