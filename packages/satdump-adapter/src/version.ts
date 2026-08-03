import { failure, type AdapterResult } from './result.js'

export function parseSatDumpVersion(input: string): AdapterResult<string> {
  const match = input.match(
    /(?:Starting SatDump|This is SatDump) v([0-9A-Za-z.+_-]+)/,
  )

  return match?.[1] === undefined
    ? failure('version.not-found', 'SatDump version banner was not found')
    : { ok: true, value: match[1] }
}
