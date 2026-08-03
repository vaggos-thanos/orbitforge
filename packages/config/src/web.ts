import { z } from 'zod'

const WebEnvironmentSchema = z.object({
  ORBITFORGE_WEB_HOST: z.literal('127.0.0.1').default('127.0.0.1'),
  ORBITFORGE_WEB_PORT: z.preprocess(
    (value) => value ?? 3000,
    z.coerce.number().int().min(1).max(65_535),
  ),
  ORBITFORGE_WORKER_SOCKET: z
    .string()
    .startsWith('/')
    .default('/run/orbitforge/worker.sock'),
  ORBITFORGE_DATABASE_PATH: z
    .string()
    .startsWith('/')
    .default('/var/lib/orbitforge/web/orbitforge.db'),
})

export interface WebConfig {
  readonly host: '127.0.0.1'
  readonly port: number
  readonly workerSocketPath: string
  readonly databasePath: string
}

export function loadWebConfig(
  environment: Record<string, string | undefined>,
): WebConfig {
  const parsed = WebEnvironmentSchema.parse(environment)

  return {
    host: parsed.ORBITFORGE_WEB_HOST,
    port: parsed.ORBITFORGE_WEB_PORT,
    workerSocketPath: parsed.ORBITFORGE_WORKER_SOCKET,
    databasePath: parsed.ORBITFORGE_DATABASE_PATH,
  }
}
