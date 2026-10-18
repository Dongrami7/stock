CREATE TABLE `snapshots` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`hash` text NOT NULL,
	`created` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `watches` (
	`owner` text NOT NULL,
	`code` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `code`)
);
