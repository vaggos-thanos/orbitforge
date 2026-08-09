import { desc, eq, sql } from 'drizzle-orm'

import {
  ReadinessSnapshotSchema,
  type ReadinessSnapshot,
} from '@orbitforge/contracts'

import type { OrbitForgeDatabase } from './client.js'
import { readinessSnapshots } from './schema/readiness.js'

export interface ReadinessRepositoryOptions {
  readonly retentionCount?: number
}

export interface ReadinessRepository {
  saveReadinessSnapshot(snapshot: unknown): void
  getLatestReadinessSnapshot(nodeId: string): ReadinessSnapshot | null
  countReadinessSnapshots(nodeId: string): number
}

export function createReadinessRepository(
  database: OrbitForgeDatabase,
  options: ReadinessRepositoryOptions = {},
): ReadinessRepository {
  const retentionCount = options.retentionCount ?? 1_000
  if (!Number.isInteger(retentionCount) || retentionCount < 1) {
    throw new Error('retentionCount must be a positive integer')
  }

  return {
    saveReadinessSnapshot(input): void {
      const snapshot = ReadinessSnapshotSchema.parse(input)
      database
        .insert(readinessSnapshots)
        .values({
          nodeId: snapshot.nodeId,
          observedAt: snapshot.observedAt,
          statusSummary: JSON.stringify({
            system: snapshot.system.status,
            storage: snapshot.storage.status,
            time: snapshot.time.status,
            sdr: snapshot.sdr.status,
            satdump: snapshot.satdump.status,
          }),
          schemaVersion: snapshot.schemaVersion,
          payload: JSON.stringify(snapshot),
        })
        .run()

      database.run(sql`
        DELETE FROM ${readinessSnapshots}
        WHERE ${readinessSnapshots.id} IN (
          SELECT ${readinessSnapshots.id}
          FROM ${readinessSnapshots}
          WHERE ${readinessSnapshots.nodeId} = ${snapshot.nodeId}
          ORDER BY ${readinessSnapshots.observedAt} DESC, ${readinessSnapshots.id} DESC
          LIMIT -1 OFFSET ${retentionCount}
        )
      `)
    },

    getLatestReadinessSnapshot(nodeId): ReadinessSnapshot | null {
      const row = database
        .select({ payload: readinessSnapshots.payload })
        .from(readinessSnapshots)
        .where(eq(readinessSnapshots.nodeId, nodeId))
        .orderBy(
          desc(readinessSnapshots.observedAt),
          desc(readinessSnapshots.id),
        )
        .limit(1)
        .get()

      return row === undefined
        ? null
        : ReadinessSnapshotSchema.parse(JSON.parse(row.payload))
    },

    countReadinessSnapshots(nodeId): number {
      const row = database
        .select({ count: sql<number>`count(*)` })
        .from(readinessSnapshots)
        .where(eq(readinessSnapshots.nodeId, nodeId))
        .get()
      return row?.count ?? 0
    },
  }
}
