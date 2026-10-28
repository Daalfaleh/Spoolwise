import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const filaments = sqliteTable("filaments", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("legacy"),
  name: text("name").notNull(),
  material: text("material").notNull(),
  color: text("color").notNull(),
  colorHex: text("color_hex").notNull(),
  colorHexes: text("color_hexes").notNull().default("[]"),
  spoolWeightGrams: real("spool_weight_grams").notNull(),
  remainingWeightGrams: real("remaining_weight_grams").notNull().default(0),
  purchaseCost: real("purchase_cost").notNull(),
  currency: text("currency").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_filaments_owner_created").on(table.ownerId, table.createdAt)]);

export const profiles = sqliteTable("profiles", {
  ownerId: text("owner_id").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  country: text("country").notNull().default(""),
  preferredCurrency: text("preferred_currency").notNull().default("SAR"),
  language: text("language").notNull().default("en"),
  updatedAt: text("updated_at").notNull(),
});

export const welcomeEmails = sqliteTable("welcome_emails", {
  ownerId: text("owner_id").primaryKey(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  claimToken: text("claim_token"),
  providerMessageId: text("provider_message_id"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  ownerId: text("owner_id").primaryKey(),
  tier: text("tier").notNull().default("free"),
  status: text("status").notNull().default("inactive"),
  provider: text("provider").notNull().default("moyasar"),
  providerTokenCiphertext: text("provider_token_ciphertext"),
  renewalMode: text("renewal_mode").notNull().default("manual"),
  currentPeriodEnd: text("current_period_end"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const subscriptionOrders = sqliteTable("subscription_orders", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  amountHalalas: integer("amount_halalas").notNull(),
  currency: text("currency").notNull().default("SAR"),
  status: text("status").notNull().default("pending"),
  paymentId: text("payment_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_subscription_orders_owner_created").on(table.ownerId, table.createdAt)]);

export const paymentEvents = sqliteTable("payment_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  paymentId: text("payment_id"),
  processedAt: text("processed_at").notNull(),
});

export const filamentUsage = sqliteTable("filament_usage", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("legacy"),
  filamentId: text("filament_id").notNull().references(() => filaments.id, { onDelete: "cascade" }),
  partName: text("part_name").notNull(),
  gramsUsed: real("grams_used").notNull(),
  deducted: integer("deducted", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_filament_usage_filament_created").on(table.filamentId, table.createdAt),
  index("idx_filament_usage_owner_created").on(table.ownerId, table.createdAt),
]);

export const printerProfiles = sqliteTable("printer_profiles", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  manufacturer: text("manufacturer").notNull().default(""),
  model: text("model").notNull().default(""),
  powerWatts: real("power_watts").notNull().default(150),
  hourlyRate: real("hourly_rate").notNull().default(0),
  currency: text("currency").notNull().default("SAR"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_printer_profiles_owner_created").on(table.ownerId, table.createdAt)]);

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  quoteNumber: text("quote_number").notNull(),
  projectName: text("project_name").notNull(),
  customerName: text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("draft"),
  totalCost: real("total_cost").notNull(),
  suggestedPrice: real("suggested_price").notNull(),
  validUntil: text("valid_until"),
  dataJson: text("data_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_quotes_owner_created").on(table.ownerId, table.createdAt),
  index("idx_quotes_owner_number").on(table.ownerId, table.quoteNumber),
]);

export const slicerConnections = sqliteTable("slicer_connections", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  slicerType: text("slicer_type").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastSeenAt: text("last_seen_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_slicer_connections_owner_created").on(table.ownerId, table.createdAt)]);

export const slicerImports = sqliteTable("slicer_imports", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  connectionId: text("connection_id").notNull().references(() => slicerConnections.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  slicer: text("slicer").notNull(),
  printerName: text("printer_name").notNull().default(""),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  filamentGrams: real("filament_grams").notNull().default(0),
  wasteGrams: real("waste_grams").notNull().default(0),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_slicer_imports_owner_created").on(table.ownerId, table.createdAt),
  index("idx_slicer_imports_connection_created").on(table.connectionId, table.createdAt),
]);
