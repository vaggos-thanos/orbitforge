import {
  ReadinessSnapshotSchema,
  type ReadinessSnapshot,
} from '@orbitforge/contracts'

import { probeSatDump } from './probes/satdump.js'
import { probeSdr } from './probes/usb.js'
import { probeStorage } from './probes/storage.js'
import { probeSystem } from './probes/system.js'
import { probeTime } from './probes/time.js'
import type { CommandRunner } from './probes/runner.js'
import type { FileReader } from './probes/types.js'

export interface ReadinessContext {
  readonly stationId: string
  readonly nodeId: string
  readonly workerId: string
  readonly satdumpConfigPath: string
  readonly satdumpServiceName: string
  readonly runner: CommandRunner
  readonly files: FileReader
  readonly now: () => Date
}

export async function collectReadinessSnapshot(
  context: ReadinessContext,
): Promise<ReadinessSnapshot> {
  const observedAt = context.now().toISOString()
  const [system, time, sdr, satdump] = await Promise.all([
    probeSystem(context.runner, observedAt),
    probeTime(context.runner, observedAt),
    probeSdr(context.runner, observedAt),
    probeSatDump(
      context.runner,
      context.files,
      context.satdumpConfigPath,
      context.satdumpServiceName,
      observedAt,
    ),
  ])
  const outputPath = satdump.config?.outputFolder ?? '/home/vaggos/satdump_out'
  const storage = await probeStorage(
    context.runner,
    context.files,
    outputPath,
    observedAt,
  )

  const sdrWithUsage = {
    ...sdr,
    devices: sdr.devices.map((device) => ({
      ...device,
      inUse:
        device.present &&
        satdump.readiness.serviceActive &&
        satdump.config?.source === 'rtlsdr',
    })),
  }
  const satdumpReadiness =
    satdump.readiness.status === 'healthy' && storage.status !== 'healthy'
      ? {
          ...satdump.readiness,
          status: 'degraded' as const,
          summary: 'SatDump is active but output storage requires attention',
        }
      : satdump.readiness

  return ReadinessSnapshotSchema.parse({
    schemaVersion: '1.0',
    stationId: context.stationId,
    nodeId: context.nodeId,
    workerId: context.workerId,
    observedAt,
    system,
    storage,
    time,
    sdr: sdrWithUsage,
    satdump: satdumpReadiness,
  })
}
