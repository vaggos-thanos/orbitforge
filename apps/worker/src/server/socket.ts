import { chmod, lstat, unlink } from 'node:fs/promises'
import { createServer, type Server, type Socket } from 'node:net'

import type { ReadinessSnapshot } from '@orbitforge/contracts'

import { routeWorkerMessage, workerErrorEnvelope } from './router.js'

export interface WorkerSocketServer {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface WorkerSocketServerOptions {
  readonly socketPath: string
  readonly source: { readonly nodeId: string; readonly workerId: string }
  readonly collectReadiness: () => Promise<ReadinessSnapshot>
  readonly now?: () => Date
  readonly maxFrameBytes?: number
}

async function removeStaleSocket(path: string): Promise<void> {
  try {
    const existing = await lstat(path)
    if (!existing.isSocket()) {
      throw new Error(`Refusing to replace non-socket path: ${path}`)
    }
    await unlink(path)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return
    }
    throw error
  }
}

export function createWorkerSocketServer(
  options: WorkerSocketServerOptions,
): WorkerSocketServer {
  const now = options.now ?? (() => new Date())
  const maxFrameBytes = options.maxFrameBytes ?? 64 * 1024
  const sockets = new Set<Socket>()
  let server: Server | null = null

  const write = (socket: Socket, message: unknown): void => {
    socket.write(`${JSON.stringify(message)}\n`)
  }

  return {
    async start(): Promise<void> {
      if (server !== null) return
      if (process.platform !== 'win32') {
        await removeStaleSocket(options.socketPath)
      }

      server = createServer((socket) => {
        sockets.add(socket)
        socket.setEncoding('utf8')
        let buffer = ''
        let closedForSize = false

        socket.on('close', () => sockets.delete(socket))
        socket.on('data', (chunk: string) => {
          if (closedForSize) return
          buffer += chunk
          if (Buffer.byteLength(buffer) > maxFrameBytes) {
            closedForSize = true
            write(
              socket,
              workerErrorEnvelope(
                'protocol.frame-too-large',
                `Frame exceeds ${maxFrameBytes} bytes`,
                {},
                { source: options.source, now },
              ),
            )
            socket.end()
            return
          }

          const lineEnd = buffer.indexOf('\n')
          if (lineEnd < 0) return
          const line = buffer.slice(0, lineEnd)
          buffer = buffer.slice(lineEnd + 1)
          void (async () => {
            let input: unknown
            try {
              input = JSON.parse(line)
            } catch {
              write(
                socket,
                workerErrorEnvelope(
                  'protocol.invalid-json',
                  'Frame is not valid JSON',
                  {},
                  { source: options.source, now },
                ),
              )
              return
            }
            write(
              socket,
              await routeWorkerMessage(input, {
                source: options.source,
                collectReadiness: options.collectReadiness,
                now,
              }),
            )
          })()
        })
      })

      await new Promise<void>((resolve, reject) => {
        server?.once('error', reject)
        server?.listen(options.socketPath, () => resolve())
      })
      if (process.platform !== 'win32') {
        await chmod(options.socketPath, 0o660)
      }
    },

    async stop(): Promise<void> {
      for (const socket of sockets) socket.destroy()
      sockets.clear()
      const current = server
      server = null
      if (current !== null) {
        await new Promise<void>((resolve, reject) => {
          current.close((error) =>
            error === undefined ? resolve() : reject(error),
          )
        })
      }
    },
  }
}
