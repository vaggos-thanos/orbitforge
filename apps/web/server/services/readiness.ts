import { ReadinessSnapshotSchema } from '@orbitforge/contracts'

import type { ReadinessRepository } from '@orbitforge/database'

import type { ReadinessApiResponse } from '../../shared/readiness.js'

export class ReadinessApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'ReadinessApiError'
    this.code = code
    this.status = status
  }
}

export interface ReadinessApiServiceOptions {
  readonly nodeId: string
  readonly getWorkerReadiness: () => Promise<unknown>
  readonly repository: Pick<
    ReadinessRepository,
    'saveReadinessSnapshot' | 'getLatestReadinessSnapshot'
  >
}

export function createReadinessApiService(options: ReadinessApiServiceOptions) {
  return {
    async getReadiness(): Promise<ReadinessApiResponse> {
      let failure: 'unavailable' | 'schema-mismatch' = 'unavailable'

      try {
        const candidate = await options.getWorkerReadiness()
        const parsed = ReadinessSnapshotSchema.safeParse(candidate)
        if (parsed.success) {
          try {
            options.repository.saveReadinessSnapshot(parsed.data)
          } catch {
            throw new ReadinessApiError(
              'readiness.persistence-failed',
              500,
              'Live readiness was received but could not be persisted.',
            )
          }
          return { source: 'live', notice: null, snapshot: parsed.data }
        }
        failure = 'schema-mismatch'
      } catch (error) {
        if (error instanceof ReadinessApiError) throw error
      }

      let cached
      try {
        cached = options.repository.getLatestReadinessSnapshot(options.nodeId)
      } catch {
        throw new ReadinessApiError(
          'readiness.cache-failed',
          500,
          'Readiness cache could not be read.',
        )
      }
      if (cached !== null) {
        return {
          source: 'cached',
          notice:
            failure === 'schema-mismatch'
              ? 'Worker response was incompatible. Showing the last validated snapshot.'
              : 'Live worker unavailable. Showing the last validated snapshot.',
          snapshot: cached,
        }
      }

      if (failure === 'schema-mismatch') {
        throw new ReadinessApiError(
          'readiness.schema-mismatch',
          502,
          'The worker returned an unsupported readiness response.',
        )
      }
      throw new ReadinessApiError(
        'readiness.worker-unavailable',
        503,
        'Live readiness is unavailable and no cached snapshot exists.',
      )
    },
  }
}
