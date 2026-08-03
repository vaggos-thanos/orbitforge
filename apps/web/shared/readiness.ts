import type { ReadinessSnapshot } from '@orbitforge/contracts'

export interface ReadinessApiResponse {
  readonly source: 'live' | 'cached'
  readonly notice: string | null
  readonly snapshot: ReadinessSnapshot
}
