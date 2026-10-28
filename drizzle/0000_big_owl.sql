CREATE TABLE `filaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`material` text NOT NULL,
	`color` text NOT NULL,
	`color_hex` text NOT NULL,
	`spool_weight_grams` real NOT NULL,
	`purchase_cost` real NOT NULL,
	`currency` text NOT NULL,
	`created_at` text NOT NULL
);
