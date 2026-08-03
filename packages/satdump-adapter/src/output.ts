const gibibyte = 1024 ** 3

export type CapacityState = 'healthy' | 'warning' | 'critical'

export interface OutputDirectoryObservation {
  readonly path: string
  readonly owner: string
  readonly group: string
  readonly mode: string
  readonly writableByService: boolean
  readonly sizeBytes: number
  readonly freeBytes: number
  readonly totalBytes: number
  readonly fileCount: number
  readonly topLevelEntries: number
}

export interface OutputWarning {
  readonly code: string
  readonly message: string
}

export interface OutputDirectorySummary extends OutputDirectoryObservation {
  readonly writable: boolean
  readonly capacityState: CapacityState
  readonly warnings: readonly OutputWarning[]
}

export function summarizeOutputDirectory(
  observation: OutputDirectoryObservation,
): OutputDirectorySummary {
  const capacityState: CapacityState =
    observation.freeBytes > 20 * gibibyte
      ? 'healthy'
      : observation.freeBytes >= 10 * gibibyte
        ? 'warning'
        : 'critical'

  const warnings: OutputWarning[] = []
  if (!observation.writableByService) {
    warnings.push({
      code: 'output.not-writable',
      message: 'The SatDump service account cannot write the output directory',
    })
  }
  if (capacityState === 'warning') {
    warnings.push({
      code: 'storage.capacity-warning',
      message: 'Storage has between 10 GiB and 20 GiB free',
    })
  } else if (capacityState === 'critical') {
    warnings.push({
      code: 'storage.capacity-critical',
      message: 'Storage has less than 10 GiB free',
    })
  }

  return {
    ...observation,
    writable: observation.writableByService,
    capacityState,
    warnings,
  }
}
