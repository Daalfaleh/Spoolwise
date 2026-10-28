import { attachPaymentToOrder, createSubscriptionOrder, getSubscriptionOrder, getUserTier } from "@/db/subscription";
import { getMoyasarConfig } from "@/lib/payments/moyasar";
import { getSupabaseUser } from "@/lib/supabase/server-auth";

function publicOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to upgrade your plan." }, { status: 401 });

  const tier = await getUserTier(user.id);
  if (tier.tier === "premium") return Response.json({ alreadyPremium: true, tier });

  try {
    const config = getMoyasarConfig();
    const orderId = await createSubscriptionOrder(user.id, config.amountHalalas);
    const methods = ["creditcard", "applepay", "stcpay"];
    if (config.samsungPayServiceId) methods.splice(2, 0, "samsungpay");
    return Response.json({
      orderId,
      amountHalalas: config.amountHalalas,
      currency: "SAR",
      publishableKey: config.publishableKey,
      callbackUrl: `${publicOrigin(request)}/api/subscribe/callback?order=${encodeURIComponent(orderId)}`,
      methods,
      samsungPayServiceId: config.samsungPayServiceId || null,
      supportedNetworks: ["mada", "visa", "mastercard"],
      metadata: { spoolwise_order_id: orderId },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "checkout_config_error", message: error instanceof Error ? error.message : "Unknown error" }));
    return Response.json({ error: "Checkout is not available yet. Please try again later." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to continue checkout." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 8_192) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const orderId = String(body?.orderId ?? "");
  const paymentId = String(body?.paymentId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[A-Za-z0-9_-]{8,120}$/.test(paymentId)) {
    return Response.json({ error: "Invalid checkout details." }, { status: 400 });
  }
  const order = await getSubscriptionOrder(orderId);
  if (!order || order.ownerId !== user.id) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "paid") return Response.json({ ok: true });
  const attached = await attachPaymentToOrder(orderId, user.id, paymentId);
  return attached
    ? Response.json({ ok: true })
    : Response.json({ error: "This order is already being processed." }, { status: 409 });
}
