import type { SatDumpReadiness } from '@orbitforge/contracts'
import {
  parseAutotrackingConfig,
  parseSatDumpUnit,
  type AutotrackingConfigSummary,
} from '@orbitforge/satdump-adapter'

import type { CommandRunner } from './runner.js'
import { probeError, type FileReader } from './types.js'

export interface SatDumpProbeResult {
  readonly readiness: SatDumpReadiness
  readonly config: AutotrackingConfigSummary | null
}

export async function probeSatDump(
  runner: CommandRunner,
  files: FileReader,
  configPath: string,
  serviceName: string,
  observedAt: string,
): Promise<SatDumpProbeResult> {
  try {
    const [configText, unitOutput] = await Promise.all([
      files.readText(configPath),
      runner.run('systemctl', [
        'show',
        serviceName,
        '--property=ActiveState',
        '--property=UnitFileState',
        '--property=User',
        '--property=Group',
        '--property=ExecStart',
        '--property=FragmentPath',
      ]),
    ])
    const config = parseAutotrackingConfig(configText)
    const unit = parseSatDumpUnit(unitOutput.stdout)
    if (!config.ok) throw new Error(config.error.message)
    if (!unit.ok) throw new Error(unit.error.message)
    return {
      config: config.value,
      readiness: {
        status: unit.value.active ? 'healthy' : 'unavailable',
        observedAt,
        summary: unit.value.active
          ? 'SatDump service is active'
          : 'SatDump service is inactive',
        version: null,
        serviceActive: unit.value.active,
        serviceEnabled: unit.value.enabled,
        httpListen: config.value.httpServer,
        outputPath: config.value.outputFolder,
        rotatorConfigured: config.value.rotatorConfigured,
        rotcldReachable: null,
      },
    }
  } catch (error) {
    return {
      config: null,
      readiness: {
        status: 'unknown',
        observedAt,
        summary: 'SatDump state could not be inspected',
        version: null,
        serviceActive: false,
        serviceEnabled: false,
        httpListen: null,
        outputPath: null,
        rotatorConfigured: false,
        rotcldReachable: null,
        error: probeError(error),
      },
    }
  }
}
