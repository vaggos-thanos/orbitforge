import type { NodeId, ResourceId, WorkerId } from './identity.js'

export type ResourceKind =
  | 'worker'
  | 'device'
  | 'antenna'
  | 'rf-path'
  | 'switch'
  | 'lna'
  | 'filter'
  | 'rotator'
  | 'storage'
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'network'

export type Capability = `${string}.${string}`

export interface Resource {
  readonly id: ResourceId
  readonly kind: ResourceKind
  readonly nodeId: NodeId
  readonly workerId?: WorkerId
  readonly name: string
  readonly capabilities: readonly Capability[]
}

export interface ResourceReservation {
  readonly resourceIds: readonly ResourceId[]
  readonly reservedFrom: string
  readonly reservedUntil: string
}
