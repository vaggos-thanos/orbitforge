import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const [databasePath, ...unexpected] = process.argv.slice(2)

if (
  databasePath === undefined ||
  unexpected.length > 0 ||
  !isAbsolute(databasePath)
) {
  console.error(
    'Usage: node scripts/migrate-database.mjs /absolute/path/orbitforge.db',
  )
  process.exitCode = 1
} else {
  try {
    const migrationsDirectoryUrl = new URL(
      '../packages/database/drizzle/',
      import.meta.url,
    )
    const migrationsDirectory = fileURLToPath(migrationsDirectoryUrl)
    const migrationNames = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
      .sort()
    if (migrationNames.length === 0) {
      throw new Error('No checked-in database migrations were found')
    }

    const sqlite = new DatabaseSync(databasePath)
    let applied = 0
    let current = 0
    try {
      sqlite.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS orbitforge_schema_migrations (
          name TEXT PRIMARY KEY NOT NULL,
          checksum TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        );
      `)
      const findMigration = sqlite.prepare(
        'SELECT checksum FROM orbitforge_schema_migrations WHERE name = ?',
      )
      const recordMigration = sqlite.prepare(
        'INSERT INTO orbitforge_schema_migrations (name, checksum) VALUES (?, ?)',
      )

      for (const name of migrationNames) {
        const sql = await readFile(
          new URL(name, migrationsDirectoryUrl),
          'utf8',
        )
        const checksum = createHash('sha256').update(sql).digest('hex')
        const existing = findMigration.get(name)
        if (existing !== undefined) {
          if (existing.checksum !== checksum) {
            throw new Error(`Applied migration checksum changed: ${name}`)
          }
          current += 1
          continue
        }

        sqlite.exec('BEGIN IMMEDIATE')
        try {
          sqlite.exec(sql)
          recordMigration.run(name, checksum)
          sqlite.exec('COMMIT')
          applied += 1
        } catch (error) {
          sqlite.exec('ROLLBACK')
          throw error
        }
      }
    } finally {
      sqlite.close()
    }

    console.log(
      `Applied ${applied} ${applied === 1 ? 'migration' : 'migrations'}; ${current} already current.`,
    )
  } catch (error) {
    console.error(
      `Migration failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
    process.exitCode = 1
  }
}
