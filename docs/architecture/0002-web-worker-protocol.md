# Web-worker protocol

Milestone 1 separates the local web process from the read-only station worker.
They communicate over `/run/orbitforge/worker.sock`; there is no TCP listener
for the worker.

## Transport and permissions

- Newline-delimited JSON, one request and one response per frame.
- Maximum frame size: 64 KiB by default.
- Socket mode: `0660`.
- Socket owner/group under the deployment templates:
  `orbitforge-worker:orbitforge`.
- `orbitforge-web` and `orbitforge-worker` have private primary groups and are
  supplementary members of `orbitforge` only for socket access.

The worker removes a stale path only when it is a Unix socket. It refuses to
replace a regular file or another path type.

## Envelope

Every message is validated against the versioned contract in
`packages/contracts` and includes:

- `protocolVersion`
- `messageId`
- `type`
- `timestamp`
- `source` (`nodeId` and `workerId`)
- `correlationId`
- `payload`

Milestone 1 supports `readiness.get`, `readiness.snapshot`, structured error
responses, and the worker heartbeat contract. Unknown versions, invalid JSON,
invalid payloads, and oversized frames receive bounded errors.

## Ownership boundaries

The worker collects and returns validated snapshots. It never accesses SQLite.
The web process validates the response again, writes successful live snapshots,
and may return the latest cached snapshot when the socket is unavailable.

`/api/readiness` is intentionally same-origin and unauthenticated in Milestone

1. The web listener is constrained to `127.0.0.1`; authentication and roles are
   deferred without placeholder middleware.
