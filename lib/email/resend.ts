import { env } from "cloudflare:workers";

type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

function emailEnvironment(name: string) {
  return String(Reflect.get(env, name) ?? "").trim();
}

export function getTransactionalEmailConfig() {
  const apiKey = emailEnvironment("RESEND_API_KEY");
  const from = emailEnvironment("EMAIL_FROM");
  const replyTo = emailEnvironment("EMAIL_REPLY_TO");

  if (!apiKey || !from) {
    throw new Error("Transactional email is not configured. Add RESEND_API_KEY and EMAIL_FROM as Cloudflare secrets.");
  }

  return { apiKey, from, replyTo };
}

export async function sendTransactionalEmail(message: OutboundEmail) {
  const config = getTransactionalEmailConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    }),
  });

  const payload = await response.json().catch(() => null) as { id?: string; message?: string } | null;
  if (!response.ok || !payload?.id) {
    throw new Error(payload?.message || `The email provider returned HTTP ${response.status}.`);
  }

  return payload.id;
}

