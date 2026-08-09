import { failure, type AdapterResult } from './result.js'

export interface SatDumpUnitSummary {
  readonly active: boolean
  readonly enabled: boolean
  readonly user: string
  readonly group: string
  readonly executable: string
  readonly configPath: string
  readonly fragmentPath: string
}

export function parseSatDumpUnit(
  input: string,
): AdapterResult<SatDumpUnitSummary> {
  const properties = new Map<string, string>()

  for (const line of input.split(/\r?\n/)) {
    const separator = line.indexOf('=')
    if (separator < 1) continue
    properties.set(line.slice(0, separator), line.slice(separator + 1))
  }

  const execStart = properties.get('ExecStart') ?? ''
  const executable = execStart.match(/path=([^ ;}]+)/)?.[1]
  const configPath = execStart.match(/\bautotrack\s+([^ ;}]+)/)?.[1]
  const user = properties.get('User')
  const group = properties.get('Group')
  const fragmentPath = properties.get('FragmentPath')

  if (
    executable === undefined ||
    configPath === undefined ||
    user === undefined ||
    group === undefined ||
    fragmentPath === undefined
  ) {
    return failure(
      'unit.invalid-shape',
      'systemd output is missing required SatDump service fields',
    )
  }

  return {
    ok: true,
    value: {
      active: properties.get('ActiveState') === 'active',
      enabled: properties.get('UnitFileState') === 'enabled',
      user,
      group,
      executable,
      configPath,
      fragmentPath,
    },
  }
}
