import { z } from 'zod'

const IdentitySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._:-]*$/)

const WorkerEnvironmentSchema = z.object({
  ORBITFORGE_STATION_ID: IdentitySchema,
  ORBITFORGE_NODE_ID: IdentitySchema,
  ORBITFORGE_WORKER_ID: IdentitySchema,
  ORBITFORGE_WORKER_SOCKET: z
    .string()
    .startsWith('/')
    .default('/run/orbitforge/worker.sock'),
  ORBITFORGE_SATDUMP_BINARY: z
    .string()
    .startsWith('/')
    .default('/usr/bin/satdump'),
  ORBITFORGE_SATDUMP_CONFIG: z
    .string()
    .startsWith('/')
    .default('/home/vaggos/autotracking_config.json'),
  ORBITFORGE_SATDUMP_SERVICE: z
    .string()
    .min(1)
    .default('satdump-autotrack.service'),
})

export interface WorkerConfig {
  readonly stationId: string
  readonly nodeId: string
  readonly workerId: string
  readonly socketPath: string
  readonly satdumpBinaryPath: string
  readonly satdumpConfigPath: string
  readonly satdumpServiceName: string
}

export function loadWorkerConfig(
  environment: Record<string, string | undefined>,
): WorkerConfig {
  const parsed = WorkerEnvironmentSchema.parse(environment)

  return {
    stationId: parsed.ORBITFORGE_STATION_ID,
    nodeId: parsed.ORBITFORGE_NODE_ID,
    workerId: parsed.ORBITFORGE_WORKER_ID,
    socketPath: parsed.ORBITFORGE_WORKER_SOCKET,
    satdumpBinaryPath: parsed.ORBITFORGE_SATDUMP_BINARY,
    satdumpConfigPath: parsed.ORBITFORGE_SATDUMP_CONFIG,
    satdumpServiceName: parsed.ORBITFORGE_SATDUMP_SERVICE,
  }
}
