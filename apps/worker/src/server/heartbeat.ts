export interface HeartbeatMonitor {
  observe(): void
  isStale(): boolean
}

export function createHeartbeatMonitor(
  maxAgeMs: number,
  now: () => number = Date.now,
): HeartbeatMonitor {
  let lastObservedAt: number | null = null

  return {
    observe(): void {
      lastObservedAt = now()
    },
    isStale(): boolean {
      return lastObservedAt === null || now() - lastObservedAt > maxAgeMs
    },
  }
}
