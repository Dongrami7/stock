CREATE TABLE `observations` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`created` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `provider_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`meta` text NOT NULL
);
