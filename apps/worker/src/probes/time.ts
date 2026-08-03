import type { TimeReadiness } from '@orbitforge/contracts'

import type { CommandRunner } from './runner.js'
import { probeError } from './types.js'

export async function probeTime(
  runner: CommandRunner,
  observedAt: string,
): Promise<TimeReadiness> {
  try {
    const output = await runner.run('timedatectl', [
      'show',
      '--property=NTPSynchronized',
      '--property=NTP',
      '--value',
    ])
    const [synchronizedValue, ntpValue] = output.stdout.trim().split(/\r?\n/)
    const synchronized = synchronizedValue === 'yes'
    const ntpActive = ntpValue === 'yes'
    return {
      status: synchronized ? 'healthy' : 'degraded',
      observedAt,
      summary: synchronized
        ? 'Network time is synchronized'
        : 'Time is not synchronized',
      synchronized,
      source: ntpActive ? 'ntp' : 'unknown',
      gpsRequired: false,
      ppsRequired: false,
    }
  } catch (error) {
    return {
      status: 'unknown',
      observedAt,
      summary: 'Time synchronization could not be inspected',
      synchronized: false,
      source: 'unknown',
      gpsRequired: false,
      ppsRequired: false,
      error: probeError(error),
    }
  }
}
