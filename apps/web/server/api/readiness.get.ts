import { createError, defineEventHandler } from 'h3'

import { loadWebConfig } from '@orbitforge/config'
import {
  createReadinessRepository,
  openDatabase,
  type DatabaseClient,
} from '@orbitforge/database'

import {
  createReadinessApiService,
  ReadinessApiError,
} from '../services/readiness.js'
import { requestWorkerReadiness } from '../utils/worker-client.js'

let databaseClient: DatabaseClient | null = null

function service() {
  const config = loadWebConfig(process.env)
  databaseClient ??= openDatabase(config.databasePath)
  return createReadinessApiService({
    nodeId: config.nodeId,
    getWorkerReadiness: () =>
      requestWorkerReadiness({
        socketPath: config.workerSocketPath,
        nodeId: config.nodeId,
      }),
    repository: createReadinessRepository(databaseClient.database),
  })
}

export default defineEventHandler(async () => {
  try {
    return await service().getReadiness()
  } catch (error) {
    if (error instanceof ReadinessApiError) {
      throw createError({
        status: error.status,
        statusText: error.message,
        data: { code: error.code },
      })
    }
    throw createError({
      status: 500,
      statusText: 'Readiness request failed.',
      data: { code: 'readiness.internal' },
    })
  }
})
