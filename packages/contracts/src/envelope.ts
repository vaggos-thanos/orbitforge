import { z } from 'zod'

const IdentitySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._:-]*$/)

export const ProtocolSourceSchema = z.strictObject({
  nodeId: IdentitySchema,
  workerId: IdentitySchema,
})

export function protocolEnvelopeSchema<PayloadSchema extends z.ZodType>(
  payloadSchema: PayloadSchema,
) {
  return z.strictObject({
    protocolVersion: z.literal('1.0'),
    messageId: z.uuid(),
    type: z.string().regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/),
    timestamp: z.iso.datetime({ offset: true }),
    source: ProtocolSourceSchema,
    correlationId: z.uuid(),
    payload: payloadSchema,
  })
}

export const ProtocolEnvelopeSchema = protocolEnvelopeSchema(z.unknown())

export type ProtocolEnvelope = z.infer<typeof ProtocolEnvelopeSchema>
export type ProtocolSource = z.infer<typeof ProtocolSourceSchema>
