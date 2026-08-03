import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const readinessSnapshots = sqliteTable(
  'readiness_snapshots',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    nodeId: text('node_id').notNull(),
    observedAt: text('observed_at').notNull(),
    statusSummary: text('status_summary').notNull(),
    schemaVersion: text('schema_version').notNull(),
    payload: text().notNull(),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('readiness_node_observed_idx').on(table.nodeId, table.observedAt),
  ],
)
