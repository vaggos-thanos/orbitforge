import { describe, expect, it } from 'vitest'

import { ReadinessSnapshotSchema } from '@orbitforge/contracts'

import {
  collectReadinessSnapshot,
  createSafeCommandRunner,
  type CommandOutput,
  type CommandRunner,
  type FileReader,
} from '../src/index.js'

class FixtureRunner implements CommandRunner {
  constructor(
    private readonly fixtures: Readonly<Record<string, string | Error>>,
  ) {}

  async run(
    command: string,
    args: readonly string[] = [],
  ): Promise<CommandOutput> {
    if (['sudo', 'rtl_test', 'satdump'].includes(command)) {
      throw new Error(`forbidden command requested: ${command}`)
    }

    const fixture = this.fixtures[[command, ...args].join(' ')]
    if (fixture instanceof Error) throw fixture
    if (fixture === undefined) throw new Error(`missing fixture: ${command}`)
    return { stdout: fixture, stderr: '' }
  }
}

class FixtureFiles implements FileReader {
  constructor(
    private readonly files: Readonly<Record<string, string>>,
    private readonly writablePaths: readonly string[] = [],
  ) {}

  async readText(path: string): Promise<string> {
    const content = this.files[path]
    if (content === undefined) throw new Error(`missing file: ${path}`)
    return content
  }

  async isWritable(path: string): Promise<boolean> {
    return this.writablePaths.includes(path)
  }
}

const commands = {
  'uname -m': 'x86_64\n',
  lscpu: 'Architecture: x86_64\nCPU(s): 12\n',
  'free --bytes':
    '              total used free shared buff/cache available\nMem: 16776589312 1 1 1 1 1\n',
  'df --block-size=1 --output=size,avail /home/vaggos/satdump_out':
    '1B-blocks Avail\n62277025792 9985280000\n',
  'stat --format=%U|%G|%a|%s /home/vaggos/satdump_out': 'root|root|755|12288\n',
  'timedatectl show --property=NTPSynchronized --property=NTP --value':
    'yes\nyes\n',
  lsusb:
    'Bus 005 Device 003: ID 0bda:2838 Realtek Semiconductor Corp. RTL2838 DVB-T\n',
  'systemctl show satdump-autotrack.service --property=ActiveState --property=UnitFileState --property=User --property=Group --property=ExecStart --property=FragmentPath':
    'ActiveState=active\nUnitFileState=enabled\nUser=vaggos\nGroup=vaggos\nExecStart={ path=/usr/bin/satdump ; argv[]=/usr/bin/satdump autotrack /home/vaggos/autotracking_config.json ; }\nFragmentPath=/etc/systemd/system/satdump-autotrack.service\n',
} as const

const satdumpConfig = JSON.stringify({
  parameters: { source: 'rtlsdr', samplerate: 1_024_000 },
  finish_processing: true,
  output_folder: '/home/vaggos/satdump_out',
  http_server: '0.0.0.0:8081',
  tracking: { autotrack_cfg: { autotrack_min_elevation: 1 } },
  tracked_objects: [{ norad: 57166 }],
})

const context = {
  stationId: 'station-1',
  nodeId: 'node-1',
  workerId: 'worker-1',
  satdumpConfigPath: '/home/vaggos/autotracking_config.json',
  satdumpServiceName: 'satdump-autotrack.service',
  runner: new FixtureRunner(commands),
  files: new FixtureFiles({
    '/home/vaggos/autotracking_config.json': satdumpConfig,
  }),
  now: () => new Date('2026-08-03T01:15:00.000Z'),
}

describe('safe command runner', () => {
  it.each(['sudo', 'rtl_test', 'satdump', 'bash'])(
    'rejects command outside the read-only allowlist: %s',
    async (command) => {
      const runner = createSafeCommandRunner(async () => ({
        stdout: '',
        stderr: '',
      }))

      await expect(runner.run(command)).rejects.toMatchObject({
        code: 'command.not-allowed',
      })
    },
  )

  it('rejects mutating systemctl arguments', async () => {
    const runner = createSafeCommandRunner(async () => ({
      stdout: '',
      stderr: '',
    }))

    await expect(
      runner.run('systemctl', ['restart', 'satdump-autotrack.service']),
    ).rejects.toMatchObject({ code: 'command.arguments-not-allowed' })
  })

  it('rejects output beyond the configured cap', async () => {
    const runner = createSafeCommandRunner(async () => ({
      stdout: 'x'.repeat(20),
      stderr: '',
    }))

    await expect(
      runner.run('uname', ['-m'], { maxOutputBytes: 10 }),
    ).rejects.toMatchObject({ code: 'command.output-limit' })
  })
})

describe('collectReadinessSnapshot', () => {
  it('collects a validated snapshot without opening the SDR or invoking SatDump', async () => {
    const snapshot = await collectReadinessSnapshot(context)

    expect(ReadinessSnapshotSchema.parse(snapshot)).toEqual(snapshot)
    expect(snapshot).toMatchObject({
      system: { status: 'healthy', cpuCount: 12 },
      storage: {
        status: 'degraded',
        writable: false,
        capacityState: 'critical',
      },
      time: {
        status: 'healthy',
        source: 'ntp',
        gpsRequired: false,
        ppsRequired: false,
      },
      sdr: {
        status: 'healthy',
        devices: [{ serial: null, present: true, inUse: true }],
      },
      satdump: {
        status: 'degraded',
        serviceActive: true,
        rotatorConfigured: false,
        rotcldReachable: null,
      },
    })
  })

  it('degrades only the failed probe instead of rejecting the snapshot', async () => {
    const snapshot = await collectReadinessSnapshot({
      ...context,
      runner: new FixtureRunner({
        ...commands,
        'timedatectl show --property=NTPSynchronized --property=NTP --value':
          new Error('timed out'),
      }),
    })

    expect(snapshot.time).toMatchObject({
      status: 'unknown',
      synchronized: false,
      source: 'unknown',
      gpsRequired: false,
      ppsRequired: false,
    })
    expect(snapshot.system.status).toBe('healthy')
    expect(snapshot.satdump.serviceActive).toBe(true)
  })
})
