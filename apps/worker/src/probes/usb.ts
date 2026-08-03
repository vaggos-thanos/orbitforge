import type { SdrReadiness } from '@orbitforge/contracts'

import type { CommandRunner } from './runner.js'
import { probeError } from './types.js'

export async function probeSdr(
  runner: CommandRunner,
  observedAt: string,
): Promise<SdrReadiness> {
  try {
    const output = await runner.run('lsusb')
    const devices = output.stdout
      .split(/\r?\n/)
      .map((line) =>
        line.match(
          /^Bus (\d+) Device (\d+): ID ([0-9a-f]{4}):([0-9a-f]{4}) (.+)$/i,
        ),
      )
      .filter((match): match is RegExpMatchArray => match !== null)
      .filter(
        (match) => match[3]?.toLowerCase() === '0bda' && match[4] === '2838',
      )
      .map((match) => ({
        id: `usb:${match[3]}:${match[4]}:${match[1]}-${match[2]}`,
        vendor: `USB ${match[3]}`,
        product: match[5] ?? 'Unknown SDR',
        serial: null,
        present: true,
        inUse: false,
      }))
    return {
      status: devices.length > 0 ? 'healthy' : 'unavailable',
      observedAt,
      summary:
        devices.length > 0
          ? `${devices.length} compatible receiver observed without opening it`
          : 'No compatible receiver was observed',
      devices,
    }
  } catch (error) {
    return {
      status: 'unknown',
      observedAt,
      summary: 'USB receivers could not be inspected',
      devices: [],
      error: probeError(error),
    }
  }
}
