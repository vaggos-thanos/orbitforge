import { constants } from 'node:fs'
import { access, readFile } from 'node:fs/promises'

import { loadWorkerConfig } from '@orbitforge/config'
import { createLogger } from '@orbitforge/observability'

import { createDefaultCommandRunner } from './probes/runner.js'
import type { FileReader } from './probes/types.js'
import { collectReadinessSnapshot } from './readiness.js'
import { createWorkerSocketServer } from './server/socket.js'

const logger = createLogger({ service: 'orbitforge-worker' })

const files: FileReader = {
  readText: (path) => readFile(path, 'utf8'),
  async isWritable(path) {
    try {
      await access(path, constants.W_OK)
      return true
    } catch {
      return false
    }
  },
}

async function main(): Promise<void> {
  const config = loadWorkerConfig(process.env)
  const runner = createDefaultCommandRunner()
  const server = createWorkerSocketServer({
    socketPath: config.socketPath,
    source: { nodeId: config.nodeId, workerId: config.workerId },
    collectReadiness: () =>
      collectReadinessSnapshot({
        stationId: config.stationId,
        nodeId: config.nodeId,
        workerId: config.workerId,
        satdumpConfigPath: config.satdumpConfigPath,
        satdumpServiceName: config.satdumpServiceName,
        runner,
        files,
        now: () => new Date(),
      }),
  })
  let stopping = false
  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    if (stopping) return
    stopping = true
    logger.info({ signal }, 'Stopping readiness worker')
    await server.stop()
  }

  process.once('SIGINT', () => void stop('SIGINT'))
  process.once('SIGTERM', () => void stop('SIGTERM'))

  await server.start()
  logger.info(
    { nodeId: config.nodeId, workerId: config.workerId },
    'Readiness worker listening on its Unix socket',
  )
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Readiness worker failed')
  process.exitCode = 1
})
