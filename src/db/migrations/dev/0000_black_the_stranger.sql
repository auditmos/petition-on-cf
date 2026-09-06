CREATE TABLE `signatures` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`surname` text NOT NULL,
	`email` text NOT NULL,
	`city` text NOT NULL,
	`signer_type` text DEFAULT 'person' NOT NULL,
	`company_name` text,
	`voivodeship_code` text,
	`consent_rodo` integer DEFAULT false NOT NULL,
	`consent_public_list` integer DEFAULT false NOT NULL,
	`consent_updates` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signatures_email_unique` ON `signatures` (`email`);