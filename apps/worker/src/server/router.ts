import { randomUUID } from 'node:crypto'

import {
  ProtocolEnvelopeSchema,
  ReadinessSnapshotSchema,
  type ProtocolSource,
  type ReadinessSnapshot,
} from '@orbitforge/contracts'

export interface RouterOptions {
  readonly source: ProtocolSource
  readonly collectReadiness: () => Promise<ReadinessSnapshot>
  readonly now: () => Date
}

function correlationId(input: unknown): string {
  if (
    typeof input === 'object' &&
    input !== null &&
    'correlationId' in input &&
    typeof input.correlationId === 'string'
  ) {
    return input.correlationId
  }
  return randomUUID()
}

export function workerErrorEnvelope(
  code: string,
  message: string,
  input: unknown,
  options: Pick<RouterOptions, 'source' | 'now'>,
) {
  return {
    protocolVersion: '1.0' as const,
    messageId: randomUUID(),
    type: 'worker.error',
    timestamp: options.now().toISOString(),
    source: options.source,
    correlationId: correlationId(input),
    payload: { code, message },
  }
}

export async function routeWorkerMessage(
  input: unknown,
  options: RouterOptions,
) {
  const parsed = ProtocolEnvelopeSchema.safeParse(input)
  if (!parsed.success || parsed.data.type !== 'readiness.get') {
    return workerErrorEnvelope(
      'protocol.invalid-message',
      'Message does not match the readiness.get protocol',
      input,
      options,
    )
  }
  if (
    typeof parsed.data.payload !== 'object' ||
    parsed.data.payload === null ||
    Object.keys(parsed.data.payload).length !== 0
  ) {
    return workerErrorEnvelope(
      'protocol.invalid-payload',
      'readiness.get payload must be an empty object',
      input,
      options,
    )
  }

  try {
    const snapshot = ReadinessSnapshotSchema.parse(
      await options.collectReadiness(),
    )
    return {
      protocolVersion: '1.0' as const,
      messageId: randomUUID(),
      type: 'readiness.snapshot',
      timestamp: options.now().toISOString(),
      source: options.source,
      correlationId: parsed.data.correlationId,
      payload: snapshot,
    }
  } catch {
    return workerErrorEnvelope(
      'readiness.collection-failed',
      'Readiness collection failed',
      input,
      options,
    )
  }
}
