import { DatabaseSync } from 'node:sqlite'

import { drizzle, type NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite'

export type OrbitForgeDatabase = NodeSQLiteDatabase

export interface DatabaseClient {
  readonly sqlite: DatabaseSync
  readonly database: OrbitForgeDatabase
  close(): void
}

export function openDatabase(path: string): DatabaseClient {
  const sqlite = new DatabaseSync(path)
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  const database = drizzle({ client: sqlite })
  return { sqlite, database, close: () => sqlite.close() }
}

export function applyMigrationForTest(
  sqlite: DatabaseSync,
  migration: string,
): void {
  const statements = migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

  sqlite.exec('BEGIN IMMEDIATE')
  try {
    for (const statement of statements) sqlite.exec(statement)
    sqlite.exec('COMMIT')
  } catch (error) {
    sqlite.exec('ROLLBACK')
    throw error
  }
}
