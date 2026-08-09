import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { createConnection } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import type { ReadinessSnapshot } from '@orbitforge/contracts'

import {
  createHeartbeatMonitor,
  createWorkerSocketServer,
  type WorkerSocketServer,
} from '../src/index.js'

const readinessSnapshot: ReadinessSnapshot = {
  schemaVersion: '1.0',
  stationId: 'station-1',
  nodeId: 'node-1',
  workerId: 'worker-1',
  observedAt: '2026-08-03T01:15:00.000Z',
  system: {
    status: 'healthy',
    observedAt: '2026-08-03T01:15:00.000Z',
    summary: 'Host telemetry available',
    architecture: 'x86_64',
    cpuCount: 12,
    totalMemoryBytes: 16_776_589_312,
  },
  storage: {
    status: 'degraded',
    observedAt: '2026-08-03T01:15:00.000Z',
    summary: 'Output storage requires operator attention',
    path: '/home/vaggos/satdump_out',
    writable: false,
    freeBytes: 9_985_280_000,
    totalBytes: 62_277_025_792,
    capacityState: 'critical',
  },
  time: {
    status: 'healthy',
    observedAt: '2026-08-03T01:15:00.000Z',
    summary: 'Network time is synchronized',
    synchronized: true,
    source: 'ntp',
    gpsRequired: false,
    ppsRequired: false,
  },
  sdr: {
    status: 'healthy',
    observedAt: '2026-08-03T01:15:00.000Z',
    summary: 'One receiver observed',
    devices: [],
  },
  satdump: {
    status: 'degraded',
    observedAt: '2026-08-03T01:15:00.000Z',
    summary: 'Output storage requires attention',
    version: null,
    serviceActive: true,
    serviceEnabled: true,
    httpListen: '0.0.0.0:8081',
    outputPath: '/home/vaggos/satdump_out',
    rotatorConfigured: false,
    rotcldReachable: null,
  },
}

function socketPath(): string {
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\orbitforge-${randomUUID()}`
    : `/tmp/orbitforge-${randomUUID()}.sock`
}

function request(
  path: string,
  message: unknown,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path)
    let buffer = ''
    socket.setEncoding('utf8')
    socket.on('connect', () => {
      socket.write(`${JSON.stringify(message)}\n`)
    })
    socket.on('data', (chunk: string) => {
      buffer += chunk
      const lineEnd = buffer.indexOf('\n')
      if (lineEnd < 0) return
      socket.end()
      resolve(JSON.parse(buffer.slice(0, lineEnd)) as Record<string, unknown>)
    })
    socket.on('error', reject)
  })
}

function readinessRequest(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: '1.0',
    messageId: '018f47a2-44ad-7c19-b38d-5ca73f67f013',
    type: 'readiness.get',
    timestamp: '2026-08-03T01:15:00.000Z',
    source: { nodeId: 'node-1', workerId: 'web-1' },
    correlationId: '1e00e446-8eb3-4a68-8d90-23433828b9ab',
    payload: {},
    ...overrides,
  }
}

const servers: WorkerSocketServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()))
})

describe('worker socket server', () => {
  it('returns a validated readiness snapshot and preserves correlation', async () => {
    const path = socketPath()
    const server = createWorkerSocketServer({
      socketPath: path,
      source: { nodeId: 'node-1', workerId: 'worker-1' },
      collectReadiness: async () => readinessSnapshot,
      now: () => new Date('2026-08-03T01:15:01.000Z'),
    })
    servers.push(server)
    await server.start()

    await expect(request(path, readinessRequest())).resolves.toMatchObject({
      protocolVersion: '1.0',
      type: 'readiness.snapshot',
      correlationId: '1e00e446-8eb3-4a68-8d90-23433828b9ab',
      source: { nodeId: 'node-1', workerId: 'worker-1' },
      payload: readinessSnapshot,
    })
  })

  it('returns a structured error for an invalid protocol version', async () => {
    const path = socketPath()
    const server = createWorkerSocketServer({
      socketPath: path,
      source: { nodeId: 'node-1', workerId: 'worker-1' },
      collectReadiness: async () => readinessSnapshot,
    })
    servers.push(server)
    await server.start()

    await expect(
      request(path, readinessRequest({ protocolVersion: '2.0' })),
    ).resolves.toMatchObject({
      protocolVersion: '1.0',
      type: 'worker.error',
      payload: { code: 'protocol.invalid-message' },
    })
  })

  it('rejects oversized frames without terminating the server', async () => {
    const path = socketPath()
    const server = createWorkerSocketServer({
      socketPath: path,
      source: { nodeId: 'node-1', workerId: 'worker-1' },
      collectReadiness: async () => readinessSnapshot,
      maxFrameBytes: 384,
    })
    servers.push(server)
    await server.start()

    await expect(
      request(path, readinessRequest({ padding: 'x'.repeat(768) })),
    ).resolves.toMatchObject({
      type: 'worker.error',
      payload: { code: 'protocol.frame-too-large' },
    })
    await expect(request(path, readinessRequest())).resolves.toMatchObject({
      type: 'readiness.snapshot',
    })
  })

  it('serves concurrent readiness requests independently', async () => {
    const path = socketPath()
    const server = createWorkerSocketServer({
      socketPath: path,
      source: { nodeId: 'node-1', workerId: 'worker-1' },
      collectReadiness: async () => readinessSnapshot,
    })
    servers.push(server)
    await server.start()

    const responses = await Promise.all(
      Array.from({ length: 3 }, () => request(path, readinessRequest())),
    )
    expect(responses.every(({ type }) => type === 'readiness.snapshot')).toBe(
      true,
    )
  })

  it.skipIf(process.platform === 'win32')(
    'creates a group-readable and non-public Unix socket',
    async () => {
      const path = socketPath()
      const server = createWorkerSocketServer({
        socketPath: path,
        source: { nodeId: 'node-1', workerId: 'worker-1' },
        collectReadiness: async () => readinessSnapshot,
      })
      servers.push(server)
      await server.start()

      expect((await stat(path)).mode & 0o777).toBe(0o660)
    },
  )
})

describe('heartbeat monitor', () => {
  it('becomes stale only after the configured maximum age', () => {
    let currentTime = 10_000
    const monitor = createHeartbeatMonitor(5_000, () => currentTime)

    monitor.observe()
    currentTime = 14_999
    expect(monitor.isStale()).toBe(false)
    currentTime = 15_001
    expect(monitor.isStale()).toBe(true)
  })

  it('is stale before the first heartbeat', () => {
    expect(createHeartbeatMonitor(5_000, () => 10_000).isStale()).toBe(true)
  })
})
