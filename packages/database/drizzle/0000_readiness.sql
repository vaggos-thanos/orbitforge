CREATE TABLE IF NOT EXISTS `readiness_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `node_id` text NOT NULL,
  `observed_at` text NOT NULL,
  `status_summary` text NOT NULL,
  `schema_version` text NOT NULL,
  `payload` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `readiness_node_observed_idx` ON `readiness_snapshots` (`node_id`, `observed_at`);
