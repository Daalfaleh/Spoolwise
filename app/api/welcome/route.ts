import { claimWelcomeEmail, markWelcomeEmailFailed, markWelcomeEmailSent } from "@/db/welcome-email";
import { renderWelcomeEmail } from "@/lib/email/templates";
import { getTransactionalEmailConfig, sendTransactionalEmail } from "@/lib/email/resend";
import { getSupabaseUser } from "@/lib/supabase/server-auth";

function userDisplayName(metadata: Record<string, unknown> | undefined, email: string) {
  const name = String(metadata?.full_name ?? metadata?.name ?? "").trim();
  return name || email.split("@")[0] || "Maker";
}

export async function POST(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Sign in to finish account setup." }, { status: 401 });

  const email = String(user.email ?? "").trim().toLowerCase();
  if (!email) return Response.json({ error: "This account does not have an email address." }, { status: 400 });

  try {
    getTransactionalEmailConfig();
  } catch (error) {
    console.error("Welcome email configuration error", error);
    return Response.json({ error: "Welcome email delivery is not configured yet." }, { status: 503 });
  }

  const claim = await claimWelcomeEmail(user.id, email);
  if (claim.state === "sent") return Response.json({ status: "already-sent" });
  if (claim.state === "busy") return Response.json({ status: "pending" }, { status: 202 });

  const appUrl = new URL("/app", request.url).toString();
  const message = renderWelcomeEmail({
    displayName: userDisplayName(user.user_metadata, email),
    appUrl,
  });

  try {
    const providerMessageId = await sendTransactionalEmail({
      to: email,
      ...message,
      idempotencyKey: `spoolwise-welcome-${user.id}`,
    });
    await markWelcomeEmailSent(user.id, claim.token, providerMessageId);
    return Response.json({ status: "sent" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email delivery error";
    await markWelcomeEmailFailed(user.id, claim.token, message);
    console.error("Welcome email delivery failed", { ownerId: user.id, message });
    return Response.json({ error: "The welcome email could not be delivered yet." }, { status: 502 });
  }
}

