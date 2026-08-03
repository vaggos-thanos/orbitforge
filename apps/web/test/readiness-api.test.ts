import { access } from 'node:fs/promises'

import { describe, expect, it, vi } from 'vitest'

import type { ReadinessSnapshot } from '@orbitforge/contracts'

import {
  ReadinessApiError,
  createReadinessApiService,
} from '../server/services/readiness.js'
import { readinessSnapshot } from './fixture.js'

function repository(cached: ReadinessSnapshot | null = null) {
  return {
    getLatestReadinessSnapshot: vi.fn(() => cached),
    saveReadinessSnapshot: vi.fn(),
  }
}

describe('readiness API service', () => {
  it('returns and persists a validated live worker snapshot', async () => {
    const snapshot = readinessSnapshot()
    const store = repository()
    const service = createReadinessApiService({
      nodeId: 'node-1',
      getWorkerReadiness: vi.fn(async () => snapshot),
      repository: store,
    })

    await expect(service.getReadiness()).resolves.toEqual({
      source: 'live',
      notice: null,
      snapshot,
    })
    expect(store.saveReadinessSnapshot).toHaveBeenCalledWith(snapshot)
  })

  it('returns a bounded unavailable error when no cached data exists', async () => {
    const service = createReadinessApiService({
      nodeId: 'node-1',
      getWorkerReadiness: vi.fn(async () => {
        throw new Error('connect ENOENT /run/orbitforge/worker.sock')
      }),
      repository: repository(),
    })

    await expect(service.getReadiness()).rejects.toMatchObject({
      code: 'readiness.worker-unavailable',
      status: 503,
      message: 'Live readiness is unavailable and no cached snapshot exists.',
    })
  })

  it('falls back to the latest validated snapshot when live data is unavailable', async () => {
    const cached = readinessSnapshot({
      observedAt: '2026-08-03T01:00:00.000Z',
    })
    const service = createReadinessApiService({
      nodeId: 'node-1',
      getWorkerReadiness: vi.fn(async () => {
        throw new Error('socket unavailable')
      }),
      repository: repository(cached),
    })

    await expect(service.getReadiness()).resolves.toEqual({
      source: 'cached',
      notice: 'Live worker unavailable. Showing the last validated snapshot.',
      snapshot: cached,
    })
  })

  it('rejects a worker schema mismatch when no cached data exists', async () => {
    const service = createReadinessApiService({
      nodeId: 'node-1',
      getWorkerReadiness: vi.fn(async () => ({
        schemaVersion: 'future',
        coordinates: [37.98, 23.72],
      })),
      repository: repository(),
    })

    await expect(service.getReadiness()).rejects.toMatchObject({
      code: 'readiness.schema-mismatch',
      status: 502,
      message: 'The worker returned an unsupported readiness response.',
    })
  })

  it('does not leak paths, raw configuration, coordinates, or underlying errors', async () => {
    const service = createReadinessApiService({
      nodeId: 'node-1',
      getWorkerReadiness: vi.fn(async () => {
        throw new Error(
          'secret=/home/vaggos/autotracking_config.json lat=37.98 lon=23.72',
        )
      }),
      repository: repository(),
    })

    let publicError: unknown
    try {
      await service.getReadiness()
    } catch (error) {
      publicError = error
    }

    expect(publicError).toBeInstanceOf(ReadinessApiError)
    const serialized = JSON.stringify(publicError)
    expect(serialized).not.toContain('autotracking_config')
    expect(serialized).not.toContain('37.98')
    expect(serialized).not.toContain('23.72')
    expect(serialized).not.toContain('secret=')
  })

  it('has no placeholder authentication middleware', async () => {
    const authenticationMiddleware = new URL(
      '../server/middleware/auth.ts',
      import.meta.url,
    )

    await expect(access(authenticationMiddleware)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
