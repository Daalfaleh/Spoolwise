CREATE TABLE `filament_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`filament_id` text NOT NULL,
	`part_name` text NOT NULL,
	`grams_used` real NOT NULL,
	`deducted` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`filament_id`) REFERENCES `filaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_filament_usage_filament_created` ON `filament_usage` (`filament_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `filaments` ADD `remaining_weight_grams` real DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `filaments` SET `remaining_weight_grams` = `spool_weight_grams` WHERE `remaining_weight_grams` = 0;
