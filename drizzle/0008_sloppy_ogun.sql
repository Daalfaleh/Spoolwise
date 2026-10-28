CREATE TABLE `printer_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`power_watts` real DEFAULT 150 NOT NULL,
	`hourly_rate` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'SAR' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_printer_profiles_owner_created` ON `printer_profiles` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`quote_number` text NOT NULL,
	`project_name` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`customer_email` text DEFAULT '' NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_cost` real NOT NULL,
	`suggested_price` real NOT NULL,
	`valid_until` text,
	`data_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quotes_owner_created` ON `quotes` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_quotes_owner_number` ON `quotes` (`owner_id`,`quote_number`);--> statement-breakpoint
CREATE TABLE `slicer_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`slicer_type` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_seen_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slicer_connections_token_hash_unique` ON `slicer_connections` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_slicer_connections_owner_created` ON `slicer_connections` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `slicer_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`file_name` text NOT NULL,
	`slicer` text NOT NULL,
	`printer_name` text DEFAULT '' NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`filament_grams` real DEFAULT 0 NOT NULL,
	`waste_grams` real DEFAULT 0 NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `slicer_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_slicer_imports_owner_created` ON `slicer_imports` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_slicer_imports_connection_created` ON `slicer_imports` (`connection_id`,`created_at`);