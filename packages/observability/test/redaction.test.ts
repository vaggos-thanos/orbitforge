import { Writable } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { createLogger, withCorrelationId } from '../src/index.js'

class CaptureStream extends Writable {
  readonly lines: string[] = []

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.lines.push(chunk.toString('utf8'))
    callback()
  }
}

describe('structured logging', () => {
  it('redacts credentials and station coordinates while preserving safe data', () => {
    const destination = new CaptureStream()
    const logger = createLogger(
      { service: 'orbitforge-worker', level: 'info' },
      destination,
    )

    logger.info({
      token: 'github-token',
      authorization: 'Bearer secret',
      cookie: 'session=secret',
      req: {
        headers: {
          authorization: 'Bearer nested-secret',
          cookie: 'nested-session=secret',
        },
      },
      station: { latitude: 40.67, longitude: 22.91 },
      qth: { lat: 40.67, lon: 22.91 },
      safe: 'visible',
    })

    const record = JSON.parse(destination.lines[0] ?? '{}') as Record<
      string,
      unknown
    >

    expect(JSON.stringify(record)).not.toContain('secret')
    expect(JSON.stringify(record)).not.toContain('40.67')
    expect(record).toMatchObject({
      service: 'orbitforge-worker',
      safe: 'visible',
      token: '[Redacted]',
      authorization: '[Redacted]',
      cookie: '[Redacted]',
    })
  })

  it('adds a correlation ID to child log records', () => {
    const destination = new CaptureStream()
    const logger = createLogger({ service: 'orbitforge-web' }, destination)
    const correlated = withCorrelationId(
      logger,
      '1e00e446-8eb3-4a68-8d90-23433828b9ab',
    )

    correlated.info({ event: 'readiness.requested' })

    expect(JSON.parse(destination.lines[0] ?? '{}')).toMatchObject({
      service: 'orbitforge-web',
      correlationId: '1e00e446-8eb3-4a68-8d90-23433828b9ab',
      event: 'readiness.requested',
    })
  })
})
