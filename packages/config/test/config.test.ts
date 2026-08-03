import { describe, expect, it } from 'vitest'

import { loadWebConfig, loadWorkerConfig } from '../src/index.js'

describe('loadWebConfig', () => {
  it('uses the approved localhost and runtime paths', () => {
    expect(loadWebConfig({})).toEqual({
      host: '127.0.0.1',
      port: 3000,
      workerSocketPath: '/run/orbitforge/worker.sock',
      databasePath: '/var/lib/orbitforge/web/orbitforge.db',
    })
  })

  it.each(['0.0.0.0', '::'])('rejects public bind address %s', (host) => {
    expect(() => loadWebConfig({ ORBITFORGE_WEB_HOST: host })).toThrow()
  })

  it('rejects invalid ports without silently falling back', () => {
    expect(() => loadWebConfig({ ORBITFORGE_WEB_PORT: 'not-a-port' })).toThrow()
    expect(() => loadWebConfig({ ORBITFORGE_WEB_PORT: '70000' })).toThrow()
  })

  it('contains no placeholder authentication configuration', () => {
    expect(loadWebConfig({})).not.toHaveProperty('auth')
    expect(loadWebConfig({})).not.toHaveProperty('sessionSecret')
  })
})

describe('loadWorkerConfig', () => {
  const identities = {
    ORBITFORGE_STATION_ID: 'station-1',
    ORBITFORGE_NODE_ID: 'node-1',
    ORBITFORGE_WORKER_ID: 'worker-1',
  }

  it('uses approved observation-only SatDump paths', () => {
    expect(loadWorkerConfig(identities)).toEqual({
      stationId: 'station-1',
      nodeId: 'node-1',
      workerId: 'worker-1',
      socketPath: '/run/orbitforge/worker.sock',
      satdumpBinaryPath: '/usr/bin/satdump',
      satdumpConfigPath: '/home/vaggos/autotracking_config.json',
      satdumpServiceName: 'satdump-autotrack.service',
    })
  })

  it.each([
    'ORBITFORGE_STATION_ID',
    'ORBITFORGE_NODE_ID',
    'ORBITFORGE_WORKER_ID',
  ] as const)('rejects a missing required identity: %s', (key) => {
    expect(() =>
      loadWorkerConfig({ ...identities, [key]: undefined }),
    ).toThrow()
  })
})
