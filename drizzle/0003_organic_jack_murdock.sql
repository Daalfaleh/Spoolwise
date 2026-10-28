ALTER TABLE `filament_usage` ADD `owner_id` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_filament_usage_owner_created` ON `filament_usage` (`owner_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `filaments` ADD `owner_id` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_filaments_owner_created` ON `filaments` (`owner_id`,`created_at`);