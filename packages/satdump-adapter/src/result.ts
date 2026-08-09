export interface AdapterError {
  readonly code: string
  readonly message: string
}

export type AdapterResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: AdapterError }

export function failure(code: string, message: string): AdapterResult<never> {
  return { ok: false, error: { code, message } }
}
