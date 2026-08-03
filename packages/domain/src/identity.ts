declare const brand: unique symbol

type BrandedId<Name extends string> = string & {
  readonly [brand]: Name
}

export type StationId = BrandedId<'StationId'>
export type NodeId = BrandedId<'NodeId'>
export type WorkerId = BrandedId<'WorkerId'>
export type JobId = BrandedId<'JobId'>
export type ResourceId = BrandedId<'ResourceId'>
