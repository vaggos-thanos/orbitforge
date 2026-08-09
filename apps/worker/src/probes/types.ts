export interface FileReader {
  readText(path: string): Promise<string>
  isWritable(path: string): Promise<boolean>
}

export interface ProbeClock {
  (): Date
}

export function probeError(error: unknown): { code: string; message: string } {
  return {
    code:
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'probe.failed',
    message: error instanceof Error ? error.message : 'Probe failed',
  }
}
