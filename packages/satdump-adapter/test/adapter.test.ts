import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  parseAutotrackingConfig,
  parseSatDumpUnit,
  parseSatDumpVersion,
  summarizeOutputDirectory,
} from '../src/index.js'

const gibibyte = 1024 ** 3

async function fixture(name: string): Promise<string> {
  return readFile(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    'utf8',
  )
}

describe('parseAutotrackingConfig', () => {
  it('extracts observation-only settings without rewriting input', async () => {
    const input = await fixture('autotracking_config.json')

    expect(parseAutotrackingConfig(input)).toEqual({
      ok: true,
      value: {
        source: 'rtlsdr',
        sampleRate: 1_024_000,
        outputFolder: '/srv/satdump/products',
        httpServer: '127.0.0.1:8081',
        finishProcessing: true,
        rotatorConfigured: false,
        trackedNoradIds: [57166, 59051],
      },
    })
    expect(input).toContain('"samplerate": 1024000')
  })

  it('returns a typed error for invalid JSON', () => {
    expect(parseAutotrackingConfig('{')).toMatchObject({
      ok: false,
      error: { code: 'config.invalid-json' },
    })
  })

  it('returns a typed error when required fields are missing', () => {
    expect(parseAutotrackingConfig('{}')).toMatchObject({
      ok: false,
      error: { code: 'config.invalid-shape' },
    })
  })
})

describe('parseSatDumpVersion', () => {
  it('extracts the build version from a startup log', async () => {
    expect(parseSatDumpVersion(await fixture('startup.txt'))).toEqual({
      ok: true,
      value: '1.2.3-943de7df0',
    })
  })

  it('reports an unknown version explicitly', () => {
    expect(parseSatDumpVersion('no banner')).toMatchObject({
      ok: false,
      error: { code: 'version.not-found' },
    })
  })
})

describe('parseSatDumpUnit', () => {
  it('extracts service identity and launch state from systemctl show output', () => {
    expect(
      parseSatDumpUnit(`ActiveState=active
UnitFileState=enabled
User=vaggos
Group=vaggos
ExecStart={ path=/usr/bin/satdump ; argv[]=/usr/bin/satdump autotrack /home/vaggos/autotracking_config.json ; }
FragmentPath=/etc/systemd/system/satdump-autotrack.service
`),
    ).toEqual({
      ok: true,
      value: {
        active: true,
        enabled: true,
        user: 'vaggos',
        group: 'vaggos',
        executable: '/usr/bin/satdump',
        configPath: '/home/vaggos/autotracking_config.json',
        fragmentPath: '/etc/systemd/system/satdump-autotrack.service',
      },
    })
  })
})

describe('summarizeOutputDirectory', () => {
  const baseObservation = {
    path: '/home/vaggos/satdump_out',
    owner: 'root',
    group: 'root',
    mode: '0755',
    writableByService: false,
    sizeBytes: 36 * gibibyte,
    freeBytes: 9 * gibibyte,
    totalBytes: 58 * gibibyte,
    fileCount: 1516,
    topLevelEntries: 92,
  } as const

  it('marks an unwritable root-owned output and low capacity as critical', () => {
    expect(summarizeOutputDirectory(baseObservation)).toMatchObject({
      capacityState: 'critical',
      writable: false,
      warnings: [
        { code: 'output.not-writable' },
        { code: 'storage.capacity-critical' },
      ],
    })
  })

  it.each([
    [21, 'healthy'],
    [20, 'warning'],
    [10, 'warning'],
    [9, 'critical'],
  ] as const)('classifies %s GiB free as %s', (freeGiB, expected) => {
    expect(
      summarizeOutputDirectory({
        ...baseObservation,
        writableByService: true,
        owner: 'vaggos',
        group: 'vaggos',
        freeBytes: freeGiB * gibibyte,
      }).capacityState,
    ).toBe(expected)
  })
})
