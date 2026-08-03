import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { DatabaseSync } from 'node:sqlite'

import { afterEach, describe, expect, it } from 'vitest'

const executeFile = promisify(execFile)
const directories: string[] = []

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function databasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'orbitforge-migrate-'))
  directories.push(directory)
  return join(directory, 'orbitforge.db')
}

describe('database migration CLI', () => {
  it('applies checked-in migrations idempotently and records their checksums', async () => {
    const path = await databasePath()

    const first = await executeFile(process.execPath, [
      'scripts/migrate-database.mjs',
      path,
    ])
    const second = await executeFile(process.execPath, [
      'scripts/migrate-database.mjs',
      path,
    ])

    expect(first.stdout).toContain('Applied 1 migration')
    expect(second.stdout).toContain('Applied 0 migrations; 1 already current')

    const sqlite = new DatabaseSync(path, { readOnly: true })
    const tables = sqlite
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN (?, ?)
         ORDER BY name`,
      )
      .all('orbitforge_schema_migrations', 'readiness_snapshots')
    const migrations = sqlite
      .prepare(
        'SELECT name, length(checksum) AS checksum_length FROM orbitforge_schema_migrations',
      )
      .all()
    sqlite.close()

    expect(tables).toEqual([
      { name: 'orbitforge_schema_migrations' },
      { name: 'readiness_snapshots' },
    ])
    expect(migrations).toEqual([
      { name: '0000_readiness.sql', checksum_length: 64 },
    ])
  })

  it('rejects relative database paths', async () => {
    await expect(
      executeFile(process.execPath, [
        'scripts/migrate-database.mjs',
        'relative.db',
      ]),
    ).rejects.toMatchObject({ code: 1 })
  })

  it('documents migration before service activation with the web writer stopped', async () => {
    const runbook = await readFile(
      new URL('../docs/operations/install-milestone-1.md', import.meta.url),
      'utf8',
    )
    const stop = runbook.indexOf('systemctl stop orbitforge-web.service')
    const migrate = runbook.indexOf('scripts/migrate-database.mjs')
    const activate = runbook.indexOf('systemctl enable --now')

    expect(stop).toBeGreaterThan(0)
    expect(migrate).toBeGreaterThan(stop)
    expect(activate).toBeGreaterThan(migrate)
  })
})
