import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import type { ReadinessSnapshot } from '@orbitforge/contracts'

import {
  applyMigrationForTest,
  createReadinessRepository,
  openDatabase,
} from '../src/index.js'

const FILE_DATABASE_TEST_TIMEOUT_MS = 15_000
const testDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    testDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

function snapshot(observedAt: string): ReadinessSnapshot {
  const probe = { status: 'healthy' as const, observedAt, summary: 'Healthy' }
  return {
    schemaVersion: '1.0',
    stationId: 'station-1',
    nodeId: 'node-1',
    workerId: 'worker-1',
    observedAt,
    system: {
      ...probe,
      architecture: 'x86_64',
      cpuCount: 12,
      totalMemoryBytes: 16_776_589_312,
    },
    storage: {
      ...probe,
      path: '/srv/products',
      writable: true,
      freeBytes: 30 * 1024 ** 3,
      totalBytes: 60 * 1024 ** 3,
      capacityState: 'healthy',
    },
    time: {
      ...probe,
      synchronized: true,
      source: 'ntp',
      gpsRequired: false,
      ppsRequired: false,
    },
    sdr: { ...probe, devices: [] },
    satdump: {
      ...probe,
      version: '1.2.3',
      serviceActive: true,
      serviceEnabled: true,
      httpListen: '127.0.0.1:8081',
      outputPath: '/srv/products',
      rotatorConfigured: false,
      rotcldReachable: null,
    },
  }
}

async function testDatabase() {
  const directory = await mkdtemp(join(tmpdir(), 'orbitforge-db-'))
  testDirectories.push(directory)
  const client = openDatabase(join(directory, 'orbitforge.db'))
  const migration = await readFile(
    fileURLToPath(new URL('../drizzle/0000_readiness.sql', import.meta.url)),
    'utf8',
  )
  applyMigrationForTest(client.sqlite, migration)
  return client
}

describe('readiness repository', () => {
  it(
    'stores and returns the latest validated snapshot for a node',
    async () => {
      const client = await testDatabase()
      const repository = createReadinessRepository(client.database)
      const older = snapshot('2026-08-03T01:00:00.000Z')
      const newer = snapshot('2026-08-03T02:00:00.000Z')

      repository.saveReadinessSnapshot(older)
      repository.saveReadinessSnapshot(newer)

      expect(repository.getLatestReadinessSnapshot('node-1')).toEqual(newer)
      client.close()
    },
    FILE_DATABASE_TEST_TIMEOUT_MS,
  )

  it(
    'rejects malformed snapshots before writing',
    async () => {
      const client = await testDatabase()
      const repository = createReadinessRepository(client.database)

      expect(() =>
        repository.saveReadinessSnapshot({ nodeId: 'node-1' }),
      ).toThrow()
      expect(repository.getLatestReadinessSnapshot('node-1')).toBeNull()
      client.close()
    },
    FILE_DATABASE_TEST_TIMEOUT_MS,
  )

  it(
    'rejects a corrupted persisted JSON payload when reading',
    async () => {
      const client = await testDatabase()
      const repository = createReadinessRepository(client.database)

      client.sqlite
        .prepare(
          `INSERT INTO readiness_snapshots
          (node_id, observed_at, status_summary, schema_version, payload)
         VALUES (?, ?, ?, ?, ?)`,
        )
        .run('node-1', '2026-08-03T02:00:00.000Z', '{}', '1.0', '{not-json')

      expect(() => repository.getLatestReadinessSnapshot('node-1')).toThrow()
      client.close()
    },
    FILE_DATABASE_TEST_TIMEOUT_MS,
  )

  it(
    'retains only the configured number of snapshots per node',
    async () => {
      const client = await testDatabase()
      const repository = createReadinessRepository(client.database, {
        retentionCount: 2,
      })

      repository.saveReadinessSnapshot(snapshot('2026-08-03T01:00:00.000Z'))
      repository.saveReadinessSnapshot(snapshot('2026-08-03T02:00:00.000Z'))
      repository.saveReadinessSnapshot(snapshot('2026-08-03T03:00:00.000Z'))

      expect(repository.countReadinessSnapshots('node-1')).toBe(2)
      client.close()
    },
    FILE_DATABASE_TEST_TIMEOUT_MS,
  )

  it(
    'applies the checked-in migration idempotently in tests',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'orbitforge-db-'))
      testDirectories.push(directory)
      const client = openDatabase(join(directory, 'orbitforge.db'))
      const migration = await readFile(
        fileURLToPath(
          new URL('../drizzle/0000_readiness.sql', import.meta.url),
        ),
        'utf8',
      )

      expect(() => {
        applyMigrationForTest(client.sqlite, migration)
        applyMigrationForTest(client.sqlite, migration)
      }).not.toThrow()
      client.close()
    },
    FILE_DATABASE_TEST_TIMEOUT_MS,
  )
})
