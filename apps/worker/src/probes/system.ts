import type { SystemReadiness } from '@orbitforge/contracts'

import type { CommandRunner } from './runner.js'
import { probeError } from './types.js'

export async function probeSystem(
  runner: CommandRunner,
  observedAt: string,
): Promise<SystemReadiness> {
  try {
    const [architecture, cpu, memory] = await Promise.all([
      runner.run('uname', ['-m']),
      runner.run('lscpu'),
      runner.run('free', ['--bytes']),
    ])
    const cpuCount = Number(cpu.stdout.match(/^CPU\(s\):\s*(\d+)/m)?.[1])
    const totalMemoryBytes = Number(memory.stdout.match(/^Mem:\s+(\d+)/m)?.[1])
    if (!Number.isInteger(cpuCount) || !Number.isInteger(totalMemoryBytes)) {
      throw new Error('System command output could not be parsed')
    }
    return {
      status: 'healthy',
      observedAt,
      summary: 'Host telemetry available',
      architecture: architecture.stdout.trim(),
      cpuCount,
      totalMemoryBytes,
    }
  } catch (error) {
    return {
      status: 'unknown',
      observedAt,
      summary: 'Host telemetry unavailable',
      architecture: 'unknown',
      cpuCount: 1,
      totalMemoryBytes: 0,
      error: probeError(error),
    }
  }
}
