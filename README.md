# OrbitForge

OrbitForge is an open ground-station platform. Milestone 1 is deliberately
small: it exposes a local, read-only station-readiness view backed by a separate
worker process. It does not schedule passes, control SatDump, open an SDR,
execute missions, or provide authentication.

## Milestone 1 architecture

- `apps/worker` observes host, storage, time, USB inventory, and the independently
  managed SatDump service through bounded, allowlisted read-only commands.
- `apps/web` serves the Nuxt readiness page and same-origin `/api/readiness` route
  on `127.0.0.1` only.
- The processes exchange versioned NDJSON messages over
  `/run/orbitforge/worker.sock`.
- The web process exclusively owns SQLite at
  `/var/lib/orbitforge/web/orbitforge.db`; the worker never opens it.
- SatDump remains independently managed. OrbitForge does not start, stop,
  restart, duplicate, or reconfigure it.

## Development

Node.js 24 LTS and the exact pnpm version in `package.json` are required.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

The test suite uses Vitest and Vue Test Utils. TypeScript is strict, ESLint uses
flat config, and formatting is checked with Prettier.

## Documentation

- [Milestone 1 boundaries](docs/architecture/0001-milestone-1-boundaries.md)
- [Web-worker protocol](docs/architecture/0002-web-worker-protocol.md)
- [Development guide](docs/operations/development.md)
- [Installation runbook](docs/operations/install-milestone-1.md)
- [Rollback runbook](docs/operations/rollback-milestone-1.md)
- [Acceptance record](docs/operations/milestone-1-acceptance.md)

The deployment files under `deploy/systemd` are reviewed templates only. No
package script installs users, units, directories, or services.

## License

AGPL-3.0-or-later
