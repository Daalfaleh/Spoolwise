CREATE TABLE `welcome_emails` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`claim_token` text,
	`provider_message_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
