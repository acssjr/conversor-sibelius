CREATE TABLE `format_feedback` (
	`score_hash` text NOT NULL,
	`profile` text NOT NULL,
	`major` integer NOT NULL,
	`revision` integer NOT NULL,
	`worked` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`score_hash`, `profile`)
);
