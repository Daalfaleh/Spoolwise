import { env } from "cloudflare:workers";
import type { SubscriptionOrder } from "@/db/subscription";

export type MoyasarPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown> | null;
  source?: { token?: string | null } | null;
};

function environmentValue(name: string) {
  return String(Reflect.get(env, name) ?? "").trim();
}

export function getMoyasarConfig() {
  const publishableKey = environmentValue("MOYASAR_PUBLISHABLE_KEY");
  const secretKey = environmentValue("MOYASAR_SECRET_KEY");
  const webhookSecret = environmentValue("MOYASAR_WEBHOOK_SECRET");
  const tokenEncryptionKey = environmentValue("SUBSCRIPTION_TOKEN_KEY");
  const samsungPayServiceId = environmentValue("MOYASAR_SAMSUNG_PAY_SERVICE_ID");
  const amountHalalas = Number(environmentValue("PREMIUM_MONTHLY_PRICE_HALALAS"));

  const invalidSettings = [
    !publishableKey.startsWith("pk_") && "MOYASAR_PUBLISHABLE_KEY",
    !secretKey.startsWith("sk_") && "MOYASAR_SECRET_KEY",
    !webhookSecret && "MOYASAR_WEBHOOK_SECRET",
    !tokenEncryptionKey && "SUBSCRIPTION_TOKEN_KEY",
  ].filter(Boolean);
  if (invalidSettings.length) {
    throw new Error(`Moyasar checkout settings are invalid: ${invalidSettings.join(", ")}.`);
  }
  if (!Number.isSafeInteger(amountHalalas) || amountHalalas < 100) {
    throw new Error("Set PREMIUM_MONTHLY_PRICE_HALALAS to the approved monthly price in halalas.");
  }
  return { publishableKey, secretKey, webhookSecret, tokenEncryptionKey, amountHalalas, samsungPayServiceId };
}

export async function secureStringEqual(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(left: ArrayBuffer, right: ArrayBuffer): boolean;
  };
  return subtle.timingSafeEqual(providedHash, expectedHash);
}

function validPayment(value: unknown): value is MoyasarPayment {
  if (!value || typeof value !== "object") return false;
  const payment = value as Record<string, unknown>;
  return typeof payment.id === "string"
    && typeof payment.status === "string"
    && typeof payment.amount === "number"
    && typeof payment.currency === "string";
}

export async function fetchMoyasarPayment(paymentId: string) {
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(paymentId)) throw new Error("Invalid Moyasar payment ID.");
  const { secretKey } = getMoyasarConfig();
  const response = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !validPayment(payload)) throw new Error(`Moyasar payment verification failed with HTTP ${response.status}.`);
  return payload;
}

export function verifyMoyasarPayment(payment: MoyasarPayment, order: SubscriptionOrder) {
  const metadataOrder = String(payment.metadata?.spoolwise_order_id ?? "");
  return payment.status === "paid"
    && payment.amount === order.amountHalalas
    && payment.currency === order.currency
    && metadataOrder === order.id;
}

function decodeBase64(value: string) {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function encryptSubscriptionToken(token: string) {
  const keyBytes = decodeBase64(getMoyasarConfig().tokenEncryptionKey);
  if (keyBytes.byteLength !== 32) throw new Error("SUBSCRIPTION_TOKEN_KEY must be a base64-encoded 32-byte key.");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token),
  ));
  return `v1.${encodeBase64(iv)}.${encodeBase64(ciphertext)}`;
}
