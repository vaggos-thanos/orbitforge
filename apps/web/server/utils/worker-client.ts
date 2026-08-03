import { randomUUID } from 'node:crypto'
import { createConnection } from 'node:net'

import { ProtocolEnvelopeSchema } from '@orbitforge/contracts'

export interface WorkerClientOptions {
  readonly socketPath: string
  readonly nodeId?: string
  readonly workerId?: string
  readonly timeoutMs?: number
  readonly maxFrameBytes?: number
}

export function requestWorkerReadiness(
  options: WorkerClientOptions,
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? 1_500
  const maxFrameBytes = options.maxFrameBytes ?? 64 * 1024
  const correlationId = randomUUID()

  return new Promise((resolve, reject) => {
    const socket = createConnection(options.socketPath)
    let buffer = ''
    let settled = false

    const finish = (error: Error | null, payload?: unknown): void => {
      if (settled) return
      settled = true
      socket.destroy()
      if (error === null) resolve(payload)
      else reject(error)
    }

    socket.setEncoding('utf8')
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => {
      socket.write(
        `${JSON.stringify({
          protocolVersion: '1.0',
          messageId: randomUUID(),
          type: 'readiness.get',
          timestamp: new Date().toISOString(),
          source: {
            nodeId: options.nodeId ?? 'web',
            workerId: options.workerId ?? 'web',
          },
          correlationId,
          payload: {},
        })}\n`,
      )
    })
    socket.once('timeout', () =>
      finish(new Error('Worker readiness request timed out')),
    )
    socket.once('error', (error) => finish(error))
    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (Buffer.byteLength(buffer) > maxFrameBytes) {
        finish(new Error('Worker readiness response exceeded the frame limit'))
        return
      }

      const lineEnd = buffer.indexOf('\n')
      if (lineEnd < 0) return

      let raw: unknown
      try {
        raw = JSON.parse(buffer.slice(0, lineEnd))
      } catch {
        finish(new Error('Worker readiness response was not valid JSON'))
        return
      }

      const envelope = ProtocolEnvelopeSchema.safeParse(raw)
      if (
        !envelope.success ||
        envelope.data.correlationId !== correlationId ||
        envelope.data.type !== 'readiness.snapshot'
      ) {
        finish(new Error('Worker readiness response was invalid'))
        return
      }

      finish(null, envelope.data.payload)
    })
  })
}
