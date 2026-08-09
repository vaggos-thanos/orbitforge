import type { ReadinessSnapshot } from '@orbitforge/contracts'

export function readinessSnapshot(
  overrides: Partial<ReadinessSnapshot> = {},
): ReadinessSnapshot {
  const observedAt = overrides.observedAt ?? '2026-08-03T02:00:00.000Z'
  const healthy = {
    status: 'healthy' as const,
    observedAt,
    summary: 'Healthy',
  }

  return {
    schemaVersion: '1.0',
    stationId: 'station-1',
    nodeId: 'node-1',
    workerId: 'worker-1',
    observedAt,
    system: {
      ...healthy,
      architecture: 'x86_64',
      cpuCount: 12,
      totalMemoryBytes: 16_776_589_312,
    },
    storage: {
      ...healthy,
      path: '/home/vaggos/satdump_out',
      writable: true,
      freeBytes: 44 * 1024 ** 3,
      totalBytes: 58 * 1024 ** 3,
      capacityState: 'healthy',
    },
    time: {
      ...healthy,
      synchronized: true,
      source: 'ntp',
      gpsRequired: false,
      ppsRequired: false,
    },
    sdr: { ...healthy, devices: [] },
    satdump: {
      ...healthy,
      version: '1.2.3',
      serviceActive: true,
      serviceEnabled: true,
      httpListen: '127.0.0.1:8081',
      outputPath: '/home/vaggos/satdump_out',
      rotatorConfigured: false,
      rotcldReachable: null,
    },
    ...overrides,
  }
}
