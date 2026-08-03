import pino, {
  type DestinationStream,
  type LevelWithSilent,
  type Logger,
} from 'pino'

export interface LoggerOptions {
  readonly service: string
  readonly level?: LevelWithSilent
}

export function createLogger(
  options: LoggerOptions,
  destination?: DestinationStream,
): Logger {
  return pino(
    {
      base: { service: options.service },
      level: options.level ?? 'info',
      redact: {
        censor: '[Redacted]',
        paths: [
          'token',
          '*.token',
          'authorization',
          'headers.authorization',
          'req.headers.authorization',
          'cookie',
          'headers.cookie',
          'req.headers.cookie',
          'station.latitude',
          'station.longitude',
          'qth.lat',
          'qth.lon',
        ],
      },
    },
    destination,
  )
}

export function withCorrelationId(logger: Logger, id: string): Logger {
  return logger.child({ correlationId: id })
}
