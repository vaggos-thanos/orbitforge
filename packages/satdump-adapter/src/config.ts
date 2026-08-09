import { z } from 'zod'

import { failure, type AdapterResult } from './result.js'

const AutotrackingConfigSchema = z.object({
  parameters: z.object({
    source: z.string().min(1),
    samplerate: z.number().int().positive(),
  }),
  finish_processing: z.boolean(),
  output_folder: z.string().min(1),
  http_server: z.string().min(1),
  tracking: z.object({
    autotrack_cfg: z.object({
      autotrack_min_elevation: z.number(),
    }),
    rotator: z.unknown().optional(),
  }),
  tracked_objects: z.array(
    z.object({
      norad: z.number().int().positive(),
    }),
  ),
})

export interface AutotrackingConfigSummary {
  readonly source: string
  readonly sampleRate: number
  readonly outputFolder: string
  readonly httpServer: string
  readonly finishProcessing: boolean
  readonly rotatorConfigured: boolean
  readonly trackedNoradIds: readonly number[]
}

export function parseAutotrackingConfig(
  input: string,
): AdapterResult<AutotrackingConfigSummary> {
  let json: unknown

  try {
    json = JSON.parse(input)
  } catch {
    return failure('config.invalid-json', 'SatDump configuration is not JSON')
  }

  const parsed = AutotrackingConfigSchema.safeParse(json)
  if (!parsed.success) {
    return failure(
      'config.invalid-shape',
      'SatDump configuration is missing required observation fields',
    )
  }

  return {
    ok: true,
    value: {
      source: parsed.data.parameters.source,
      sampleRate: parsed.data.parameters.samplerate,
      outputFolder: parsed.data.output_folder,
      httpServer: parsed.data.http_server,
      finishProcessing: parsed.data.finish_processing,
      rotatorConfigured: parsed.data.tracking.rotator !== undefined,
      trackedNoradIds: parsed.data.tracked_objects.map(({ norad }) => norad),
    },
  }
}
