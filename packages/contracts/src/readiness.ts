import { z } from 'zod'

export const HealthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'unavailable',
  'unknown',
])

const ProbeErrorSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
})

const ProbeFields = {
  status: HealthStatusSchema,
  observedAt: z.iso.datetime({ offset: true }),
  summary: z.string().min(1),
  error: ProbeErrorSchema.optional(),
} as const

export const SystemReadinessSchema = z.strictObject({
  ...ProbeFields,
  architecture: z.string().min(1),
  cpuCount: z.number().int().positive(),
  totalMemoryBytes: z.number().int().nonnegative(),
})

export const StorageReadinessSchema = z.strictObject({
  ...ProbeFields,
  path: z.string().min(1),
  writable: z.boolean(),
  freeBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  capacityState: z.enum(['healthy', 'warning', 'critical']),
})

export const TimeReadinessSchema = z.strictObject({
  ...ProbeFields,
  synchronized: z.boolean(),
  source: z.enum(['ntp', 'gps', 'pps', 'unknown']),
  gpsRequired: z.boolean(),
  ppsRequired: z.boolean(),
})

export const SdrDeviceSchema = z.strictObject({
  id: z.string().min(1),
  vendor: z.string().min(1),
  product: z.string().min(1),
  serial: z.string().min(1).nullable(),
  present: z.boolean(),
  inUse: z.boolean(),
})

export const SdrReadinessSchema = z.strictObject({
  ...ProbeFields,
  devices: z.array(SdrDeviceSchema),
})

export const SatDumpReadinessSchema = z.strictObject({
  ...ProbeFields,
  version: z.string().min(1).nullable(),
  serviceActive: z.boolean(),
  serviceEnabled: z.boolean(),
  httpListen: z.string().min(1).nullable(),
  outputPath: z.string().min(1).nullable(),
  rotatorConfigured: z.boolean(),
  rotcldReachable: z.boolean().nullable(),
})

export const ReadinessSnapshotSchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  stationId: z.string().min(1),
  nodeId: z.string().min(1),
  workerId: z.string().min(1),
  observedAt: z.iso.datetime({ offset: true }),
  system: SystemReadinessSchema,
  storage: StorageReadinessSchema,
  time: TimeReadinessSchema,
  sdr: SdrReadinessSchema,
  satdump: SatDumpReadinessSchema,
})

export type HealthStatus = z.infer<typeof HealthStatusSchema>
export type ReadinessSnapshot = z.infer<typeof ReadinessSnapshotSchema>
export type SatDumpReadiness = z.infer<typeof SatDumpReadinessSchema>
export type SdrReadiness = z.infer<typeof SdrReadinessSchema>
export type StorageReadiness = z.infer<typeof StorageReadinessSchema>
export type SystemReadiness = z.infer<typeof SystemReadinessSchema>
export type TimeReadiness = z.infer<typeof TimeReadinessSchema>
