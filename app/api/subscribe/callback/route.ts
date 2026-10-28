import {
  activatePremiumSubscription,
  claimSubscriptionOrderForActivation,
  getSubscriptionOrder,
  releaseSubscriptionOrderClaim,
} from "@/db/subscription";
import { encryptSubscriptionToken, fetchMoyasarPayment, verifyMoyasarPayment } from "@/lib/payments/moyasar";

function appRedirect(request: Request, result: "success" | "failed") {
  const url = new URL(request.url);
  return Response.redirect(`${url.protocol}//${url.host}/app?upgrade=${result}`, 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order") ?? "";
  const paymentId = url.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[A-Za-z0-9_-]{8,120}$/.test(paymentId)) {
    return appRedirect(request, "failed");
  }

  const order = await getSubscriptionOrder(orderId);
  if (!order) return appRedirect(request, "failed");
  if (order.status === "paid") return appRedirect(request, "success");

  try {
    const payment = await fetchMoyasarPayment(paymentId);
    if (!verifyMoyasarPayment(payment, order)) throw new Error("Payment details did not match the order.");
    const claimed = await claimSubscriptionOrderForActivation(order.id, payment.id);
    if (!claimed) {
      const current = await getSubscriptionOrder(order.id);
      return appRedirect(request, current?.status === "paid" || current?.status === "processing" ? "success" : "failed");
    }
    try {
      const rawToken = String(payment.source?.token ?? "").trim();
      const encryptedToken = rawToken ? await encryptSubscriptionToken(rawToken) : null;
      await activatePremiumSubscription({ order, paymentId: payment.id, encryptedToken });
    } catch (error) {
      await releaseSubscriptionOrderClaim(order.id);
      throw error;
    }
    console.log(JSON.stringify({ event: "subscription_activated", orderId: order.id, paymentId: payment.id }));
    return appRedirect(request, "success");
  } catch (error) {
    console.error(JSON.stringify({ event: "subscription_callback_failed", orderId, paymentId, message: error instanceof Error ? error.message : "Unknown error" }));
    return appRedirect(request, "failed");
  }
}
