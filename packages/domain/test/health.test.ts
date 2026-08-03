import { describe, expect, it } from 'vitest'

import { aggregateHealthStatus } from '../src/index.js'

describe('aggregateHealthStatus', () => {
  it('returns unknown when no observations exist', () => {
    expect(aggregateHealthStatus([])).toBe('unknown')
  })

  it('returns the most severe observed health state', () => {
    expect(aggregateHealthStatus(['healthy', 'degraded', 'unknown'])).toBe(
      'degraded',
    )
    expect(aggregateHealthStatus(['healthy', 'unavailable', 'degraded'])).toBe(
      'unavailable',
    )
  })
})
