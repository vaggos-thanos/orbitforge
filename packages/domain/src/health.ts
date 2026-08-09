export type HealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown'

export interface ResourceHealth {
  readonly status: HealthStatus
  readonly observedAt: string
  readonly summary: string
  readonly error?: {
    readonly code: string
    readonly message: string
  }
}

const severity: Readonly<Record<HealthStatus, number>> = {
  healthy: 0,
  unknown: 1,
  degraded: 2,
  unavailable: 3,
}

export function aggregateHealthStatus(
  statuses: readonly HealthStatus[],
): HealthStatus {
  if (statuses.length === 0) return 'unknown'

  return statuses.reduce((worst, current) =>
    severity[current] > severity[worst] ? current : worst,
  )
}
