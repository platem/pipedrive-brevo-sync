CREATE INDEX `idx_filters_deleted_at` ON `filters` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_session_user_id` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_session_expires_at` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_jobs_filter_id` ON `sync_jobs` (`filter_id`);--> statement-breakpoint
CREATE INDEX `idx_sync_jobs_status` ON `sync_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sync_jobs_created_at` ON `sync_jobs` (`created_at`);