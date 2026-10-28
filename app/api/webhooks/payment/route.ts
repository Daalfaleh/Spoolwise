import { waitUntil } from "cloudflare:workers";
import {
  activatePremiumSubscription,
  claimSubscriptionOrderForActivation,
  getSubscriptionOrder,
  hasProcessedPaymentEvent,
  recordPaymentEvent,
  releaseSubscriptionOrderClaim,
} from "@/db/subscription";
import {
  encryptSubscriptionToken,
  fetchMoyasarPayment,
  getMoyasarConfig,
  secureStringEqual,
  verifyMoyasarPayment,
} from "@/lib/payments/moyasar";

type WebhookPayload = {
  id?: unknown;
  type?: unknown;
  secret_token?: unknown;
  data?: { id?: unknown } | null;
};

async function processPaidEvent(eventId: string, paymentId: string) {
  if (await hasProcessedPaymentEvent(eventId)) return;
  const payment = await fetchMoyasarPayment(paymentId);
  const orderId = String(payment.metadata?.spoolwise_order_id ?? "");
  const order = await getSubscriptionOrder(orderId);
  if (!order || !verifyMoyasarPayment(payment, order)) throw new Error("Verified payment does not match a subscription order.");
  if (order.status === "paid") {
    await recordPaymentEvent(eventId, "payment_paid", payment.id);
    return;
  }
  const claimed = await claimSubscriptionOrderForActivation(order.id, payment.id);
  if (!claimed) return;
  try {
    const rawToken = String(payment.source?.token ?? "").trim();
    const encryptedToken = rawToken ? await encryptSubscriptionToken(rawToken) : null;
    await activatePremiumSubscription({ order, paymentId: payment.id, encryptedToken });
    await recordPaymentEvent(eventId, "payment_paid", payment.id);
    console.log(JSON.stringify({ event: "subscription_webhook_activated", orderId: order.id, paymentId: payment.id }));
  } catch (error) {
    await releaseSubscriptionOrderClaim(order.id);
    throw error;
  }
}

export async function POST(request: Request) {
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > 65_536) return Response.json({ error: "Payload too large." }, { status: 413 });
  const payload = await request.json().catch(() => null) as WebhookPayload | null;
  if (!payload || typeof payload.secret_token !== "string") return Response.json({ error: "Invalid webhook." }, { status: 400 });

  let expectedSecret: string;
  try {
    expectedSecret = getMoyasarConfig().webhookSecret;
  } catch {
    return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  }
  if (!(await secureStringEqual(payload.secret_token, expectedSecret))) {
    return Response.json({ error: "Invalid webhook secret." }, { status: 401 });
  }

  const eventId = String(payload.id ?? "");
  const eventType = String(payload.type ?? "");
  const paymentId = String(payload.data?.id ?? "");
  if (!eventId || eventId.length > 160) return Response.json({ error: "Invalid event id." }, { status: 400 });
  if (eventType !== "payment_paid") return Response.json({ accepted: true }, { status: 202 });
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(paymentId)) return Response.json({ error: "Invalid payment id." }, { status: 400 });

  waitUntil(processPaidEvent(eventId, paymentId).catch((error) => {
    console.error(JSON.stringify({ event: "subscription_webhook_failed", eventId, paymentId, message: error instanceof Error ? error.message : "Unknown error" }));
  }));
  return Response.json({ accepted: true }, { status: 202 });
}
