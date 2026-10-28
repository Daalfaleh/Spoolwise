ALTER TABLE `filaments` ADD `color_hexes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `filaments` SET `color_hexes` = '["' || `color_hex` || '"]' WHERE `color_hexes` = '[]';
