import { getD1 } from "./filaments";

export type UserTier = {
  tier: "free" | "premium";
  status: string;
  currentPeriodEnd: string | null;
};

export type SubscriptionOrder = {
  id: string;
  ownerId: string;
  amountHalalas: number;
  currency: string;
  status: string;
  paymentId: string | null;
};

const createSubscriptionTablesSql = [
  `CREATE TABLE IF NOT EXISTS subscriptions (
    owner_id TEXT PRIMARY KEY NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
    status TEXT NOT NULL DEFAULT 'inactive',
    provider TEXT NOT NULL DEFAULT 'moyasar',
    provider_token_ciphertext TEXT,
    renewal_mode TEXT NOT NULL DEFAULT 'manual' CHECK (renewal_mode IN ('automatic', 'manual')),
    current_period_end TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_orders (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    amount_halalas INTEGER NOT NULL CHECK (amount_halalas >= 100),
    currency TEXT NOT NULL DEFAULT 'SAR',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_subscription_orders_owner_created ON subscription_orders(owner_id, created_at)",
  `CREATE TABLE IF NOT EXISTS payment_events (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    payment_id TEXT,
    processed_at TEXT NOT NULL
  )`,
];

export async function ensureSubscriptionTables() {
  const db = getD1();
  for (const statement of createSubscriptionTablesSql) await db.prepare(statement).run();
}

export async function getUserTier(ownerId: string, now = new Date()): Promise<UserTier> {
  await ensureSubscriptionTables();
  const row = await getD1().prepare(`
    SELECT tier, status, current_period_end
    FROM subscriptions
    WHERE owner_id = ?
  `).bind(ownerId).first<Record<string, unknown>>();

  const periodEnd = row?.current_period_end ? String(row.current_period_end) : null;
  const active = row?.tier === "premium"
    && row?.status === "active"
    && (!periodEnd || Date.parse(periodEnd) > now.getTime());
  return {
    tier: active ? "premium" : "free",
    status: active ? "active" : String(row?.status ?? "inactive"),
    currentPeriodEnd: periodEnd,
  };
}

export async function createSubscriptionOrder(ownerId: string, amountHalalas: number) {
  await ensureSubscriptionTables();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO subscription_orders
      (id, owner_id, amount_halalas, currency, status, created_at, updated_at)
    VALUES (?, ?, ?, 'SAR', 'pending', ?, ?)
  `).bind(id, ownerId, amountHalalas, now, now).run();
  return id;
}

export async function getSubscriptionOrder(id: string): Promise<SubscriptionOrder | null> {
  await ensureSubscriptionTables();
  const row = await getD1().prepare("SELECT * FROM subscription_orders WHERE id = ?")
    .bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    amountHalalas: Number(row.amount_halalas),
    currency: String(row.currency),
    status: String(row.status),
    paymentId: row.payment_id ? String(row.payment_id) : null,
  };
}

export async function attachPaymentToOrder(id: string, ownerId: string, paymentId: string) {
  const result = await getD1().prepare(`
    UPDATE subscription_orders
    SET payment_id = ?, updated_at = ?
    WHERE id = ? AND owner_id = ? AND status = 'pending'
  `).bind(paymentId, new Date().toISOString(), id, ownerId).run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function claimSubscriptionOrderForActivation(id: string, paymentId: string) {
  const result = await getD1().prepare(`
    UPDATE subscription_orders
    SET status = 'processing', payment_id = ?, updated_at = ?
    WHERE id = ? AND status = 'pending'
  `).bind(paymentId, new Date().toISOString(), id).run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function releaseSubscriptionOrderClaim(id: string) {
  await getD1().prepare(`
    UPDATE subscription_orders
    SET status = 'pending', updated_at = ?
    WHERE id = ? AND status = 'processing'
  `).bind(new Date().toISOString(), id).run();
}

export async function activatePremiumSubscription(options: {
  order: SubscriptionOrder;
  paymentId: string;
  encryptedToken: string | null;
}) {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const timestamp = now.toISOString();
  const renewalMode = options.encryptedToken ? "automatic" : "manual";
  const db = getD1();
  await db.batch([
    db.prepare(`
      UPDATE subscription_orders
      SET status = 'paid', payment_id = ?, updated_at = ?
      WHERE id = ? AND owner_id = ? AND status = 'processing'
    `).bind(options.paymentId, timestamp, options.order.id, options.order.ownerId),
    db.prepare(`
      INSERT INTO subscriptions
        (owner_id, tier, status, provider, provider_token_ciphertext, renewal_mode, current_period_end, created_at, updated_at)
      VALUES (?, 'premium', 'active', 'moyasar', ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id) DO UPDATE SET
        tier = 'premium', status = 'active', provider = 'moyasar',
        provider_token_ciphertext = COALESCE(excluded.provider_token_ciphertext, subscriptions.provider_token_ciphertext),
        renewal_mode = excluded.renewal_mode,
        current_period_end = excluded.current_period_end,
        updated_at = excluded.updated_at
    `).bind(options.order.ownerId, options.encryptedToken, renewalMode, periodEnd, timestamp, timestamp),
  ]);
  return periodEnd;
}

export async function hasProcessedPaymentEvent(id: string) {
  await ensureSubscriptionTables();
  return Boolean(await getD1().prepare("SELECT id FROM payment_events WHERE id = ?").bind(id).first());
}

export async function recordPaymentEvent(id: string, type: string, paymentId: string | null) {
  await getD1().prepare(`
    INSERT OR IGNORE INTO payment_events (id, type, payment_id, processed_at)
    VALUES (?, ?, ?, ?)
  `).bind(id, type, paymentId, new Date().toISOString()).run();
}
