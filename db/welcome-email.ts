import { getD1 } from "./filaments";

type WelcomeEmailRow = {
  status: string;
  claim_token: string | null;
};

export type WelcomeEmailClaim =
  | { state: "claimed"; token: string }
  | { state: "sent" }
  | { state: "busy" };

const createWelcomeEmailsTableSql = `
  CREATE TABLE IF NOT EXISTS welcome_emails (
    owner_id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    claim_token TEXT,
    provider_message_id TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export async function ensureWelcomeEmailsTable() {
  await getD1().prepare(createWelcomeEmailsTableSql).run();
}

export async function claimWelcomeEmail(ownerId: string, email: string, now = new Date()): Promise<WelcomeEmailClaim> {
  await ensureWelcomeEmailsTable();

  const timestamp = now.toISOString();
  await getD1().prepare(`
    INSERT OR IGNORE INTO welcome_emails
      (owner_id, email, status, attempts, created_at, updated_at)
    VALUES (?, ?, 'pending', 0, ?, ?)
  `).bind(ownerId, email, timestamp, timestamp).run();

  const current = await getD1().prepare("SELECT status, claim_token FROM welcome_emails WHERE owner_id = ?")
    .bind(ownerId).first<WelcomeEmailRow>();
  if (current?.status === "sent") return { state: "sent" };

  const token = crypto.randomUUID();
  const retryFailedBefore = new Date(now.getTime() - 60_000).toISOString();
  const retryStaleBefore = new Date(now.getTime() - 10 * 60_000).toISOString();
  await getD1().prepare(`
    UPDATE welcome_emails
    SET email = ?, status = 'sending', claim_token = ?, attempts = attempts + 1,
        last_error = NULL, updated_at = ?
    WHERE owner_id = ?
      AND (
        status = 'pending'
        OR (status = 'failed' AND updated_at <= ?)
        OR (status = 'sending' AND updated_at <= ?)
      )
  `).bind(email, token, timestamp, ownerId, retryFailedBefore, retryStaleBefore).run();

  const claimed = await getD1().prepare("SELECT status, claim_token FROM welcome_emails WHERE owner_id = ?")
    .bind(ownerId).first<WelcomeEmailRow>();
  return claimed?.status === "sending" && claimed.claim_token === token
    ? { state: "claimed", token }
    : { state: "busy" };
}

export async function markWelcomeEmailSent(ownerId: string, claimToken: string, providerMessageId: string) {
  const now = new Date().toISOString();
  await getD1().prepare(`
    UPDATE welcome_emails
    SET status = 'sent', claim_token = NULL, provider_message_id = ?, sent_at = ?, updated_at = ?
    WHERE owner_id = ? AND status = 'sending' AND claim_token = ?
  `).bind(providerMessageId, now, now, ownerId, claimToken).run();
}

export async function markWelcomeEmailFailed(ownerId: string, claimToken: string, message: string) {
  await getD1().prepare(`
    UPDATE welcome_emails
    SET status = 'failed', claim_token = NULL, last_error = ?, updated_at = ?
    WHERE owner_id = ? AND status = 'sending' AND claim_token = ?
  `).bind(message.slice(0, 500), new Date().toISOString(), ownerId, claimToken).run();
}

