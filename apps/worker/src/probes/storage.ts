import type { StorageReadiness } from '@orbitforge/contracts'

import type { CommandRunner } from './runner.js'
import { probeError, type FileReader } from './types.js'

const gibibyte = 1024 ** 3

export async function probeStorage(
  runner: CommandRunner,
  files: FileReader,
  path: string,
  observedAt: string,
): Promise<StorageReadiness> {
  try {
    const [disk, stat, writable] = await Promise.all([
      runner.run('df', ['--block-size=1', '--output=size,avail', path]),
      runner.run('stat', ['--format=%U|%G|%a|%s', path]),
      files.isWritable(path),
    ])
    const values = disk.stdout.trim().split(/\s+/).slice(-2).map(Number)
    const [totalBytes, freeBytes] = values
    if (
      totalBytes === undefined ||
      freeBytes === undefined ||
      !Number.isFinite(totalBytes) ||
      !Number.isFinite(freeBytes) ||
      stat.stdout.trim().split('|').length !== 4
    ) {
      throw new Error('Storage command output could not be parsed')
    }
    const capacityState =
      freeBytes > 20 * gibibyte
        ? 'healthy'
        : freeBytes >= 10 * gibibyte
          ? 'warning'
          : 'critical'
    const status =
      writable && capacityState === 'healthy' ? 'healthy' : 'degraded'
    return {
      status,
      observedAt,
      summary:
        status === 'healthy'
          ? 'Output storage is writable with sufficient capacity'
          : 'Output storage requires operator attention',
      path,
      writable,
      freeBytes,
      totalBytes,
      capacityState,
    }
  } catch (error) {
    return {
      status: 'unknown',
      observedAt,
      summary: 'Output storage could not be inspected',
      path,
      writable: false,
      freeBytes: 0,
      totalBytes: 0,
      capacityState: 'critical',
      error: probeError(error),
    }
  }
}
