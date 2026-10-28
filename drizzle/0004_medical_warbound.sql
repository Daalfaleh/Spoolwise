CREATE TABLE `profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`preferred_currency` text DEFAULT 'SAR' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`updated_at` text NOT NULL
);
