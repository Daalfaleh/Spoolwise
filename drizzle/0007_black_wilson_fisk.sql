CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payment_id` text,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscription_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`amount_halalas` integer NOT NULL,
	`currency` text DEFAULT 'SAR' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_subscription_orders_owner_created` ON `subscription_orders` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`provider` text DEFAULT 'moyasar' NOT NULL,
	`provider_token_ciphertext` text,
	`renewal_mode` text DEFAULT 'manual' NOT NULL,
	`current_period_end` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
