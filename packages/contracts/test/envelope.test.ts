import { describe, expect, it } from 'vitest'

import {
  ProtocolEnvelopeSchema,
  ReadinessSnapshotSchema,
  protocolEnvelopeSchema,
} from '../src/index.js'

const readinessSnapshot = {
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
    summary: 'Less than 10 GB free',
    path: '/home/vaggos/satdump_out',
    writable: false,
    freeBytes: 9_985_280_000,
    totalBytes: 62_277_025_792,
    capacityState: 'critical',
  },
  time: {
    status: 'healthy',
    observedAt: '2026-08-03T01:15:00.000Z',
    summary: 'NTP synchronized',
    synchronized: true,
    source: 'ntp',
    gpsRequired: false,
    ppsRequired: false,
  },
  sdr: {
    status: 'healthy',
    observedAt: '2026-08-03T01:15:00.000Z',
    summary: 'One receiver observed without opening it',
    devices: [
      {
        id: 'usb:0bda:2838:00000101',
        vendor: 'RTLSDRBlog',
        product: 'Blog V4',
        serial: '00000101',
        present: true,
        inUse: true,
      },
    ],
  },
  satdump: {
    status: 'degraded',
    observedAt: '2026-08-03T01:15:00.000Z',
    summary: 'Running; output is not writable',
    version: '1.2.3-943de7df0',
    serviceActive: true,
    serviceEnabled: true,
    httpListen: '0.0.0.0:8081',
    outputPath: '/home/vaggos/satdump_out',
    rotatorConfigured: false,
    rotcldReachable: null,
  },
} as const

const envelope = {
  protocolVersion: '1.0',
  messageId: '018f47a2-44ad-7c19-b38d-5ca73f67f013',
  type: 'readiness.snapshot',
  timestamp: '2026-08-03T01:15:00.000Z',
  source: { nodeId: 'node-1', workerId: 'worker-1' },
  correlationId: '1e00e446-8eb3-4a68-8d90-23433828b9ab',
  payload: readinessSnapshot,
} as const

describe('protocol envelope', () => {
  it('accepts a valid versioned readiness message', () => {
    const schema = protocolEnvelopeSchema(ReadinessSnapshotSchema)

    expect(schema.parse(envelope)).toEqual(envelope)
    expect(ProtocolEnvelopeSchema.parse(envelope)).toEqual(envelope)
  })

  it.each([
    ['protocol version', { protocolVersion: '2.0' }],
    ['message UUID', { messageId: 'not-a-uuid' }],
    ['timestamp', { timestamp: '2026-08-03 01:15:00' }],
    ['namespaced type', { type: 'Readiness Snapshot' }],
  ])('rejects an invalid %s', (_label, replacement) => {
    expect(() =>
      ProtocolEnvelopeSchema.parse({ ...envelope, ...replacement }),
    ).toThrow()
  })

  it('rejects undeclared envelope fields', () => {
    expect(() =>
      ProtocolEnvelopeSchema.parse({ ...envelope, hiddenState: true }),
    ).toThrow()
  })
})

describe('readiness snapshot', () => {
  it('accepts explicit health and uncertainty fields', () => {
    expect(ReadinessSnapshotSchema.parse(readinessSnapshot)).toEqual(
      readinessSnapshot,
    )
  })

  it('rejects an undeclared health state', () => {
    expect(() =>
      ReadinessSnapshotSchema.parse({
        ...readinessSnapshot,
        system: { ...readinessSnapshot.system, status: 'mostly-fine' },
      }),
    ).toThrow()
  })

  it('rejects undeclared snapshot fields', () => {
    expect(() =>
      ReadinessSnapshotSchema.parse({ ...readinessSnapshot, guessed: true }),
    ).toThrow()
  })
})
