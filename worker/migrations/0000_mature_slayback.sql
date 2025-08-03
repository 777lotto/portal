-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `d1_migrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text,
	`applied_at` numeric DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`email` text,
	`name` text NOT NULL,
	`password_hash` text,
	`stripe_customer_id` text,
	`phone` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`address` text,
	`company_name` text,
	`email_notifications_enabled` integer DEFAULT 1 NOT NULL,
	`sms_notifications_enabled` integer DEFAULT 1 NOT NULL,
	`preferred_contact_method` text DEFAULT 'email',
	`calendar_reminders_enabled` integer DEFAULT 1 NOT NULL,
	`calendar_reminder_minutes` integer DEFAULT 60 NOT NULL,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE INDEX `idx_users_phone` ON `users` (`phone`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`recurrence` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	`stripe_invoice_id` text,
	`stripe_quote_id` text,
	`total_amount_cents` integer,
	`due` text,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE TABLE `line_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`job_id` text,
	`description` text,
	`unit_total_amount_cents` integer,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE INDEX `idx_line_items_job_id` ON `line_items` (`job_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY,
	`user_id` integer NOT NULL,
	`invoice_id` text,
	`item_id` integer,
	`job_id` text,
	`url` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`is_read` integer DEFAULT 0 NOT NULL,
	`channels` text,
	`status` text NOT NULL,
	`metadata` text,
	`push_subscription_json` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_id` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `job_recurrence_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`job_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`frequency` integer NOT NULL,
	`requested_day` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE INDEX `idx_job_recurrence_requests_status` ON `job_recurrence_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_job_recurrence_requests_job_id` ON `job_recurrence_requests` (`job_id`);--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`due` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE TABLE `calendar_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_tokens_user_id` ON `calendar_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`photo_id` text,
	`item_id` integer,
	`job_id` text,
	`content` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`type` text NOT NULL,
	`job_id` text,
	`user_id` integer,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "users_check_1" CHECK(preferred_contact_method IN ('email', 'sms'),
	CONSTRAINT "notifications_check_2" CHECK(status IN ('pending', 'sent', 'failed'),
	CONSTRAINT "job_recurrence_requests_check_3" CHECK(status IN ('pending', 'accepted', 'declined', 'countered'),
	CONSTRAINT "calendar_events_check_4" CHECK(type IN ('job', 'blocked', 'personal')
);

*/