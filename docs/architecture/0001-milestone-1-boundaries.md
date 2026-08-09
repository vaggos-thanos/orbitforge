# Milestone 1 Boundaries

Milestone 1 delivers a read-only station-readiness vertical slice. It does not schedule missions, reserve RF resources, launch SatDump, open SDR devices, manage products, or authenticate users.

## Runtime

- Node.js 24 LTS
- pnpm 11.18.0, pinned in `package.json`
- Strict TypeScript
- Vitest and Vue Test Utils
- ESLint flat config and Prettier
- systemd journal for runtime logs

The SQLite implementation uses Drizzle `1.0.0-rc.4` with Node 24's built-in `node:sqlite` driver. This avoids native addon build scripts, but both integrations must be reviewed for stable releases before a production milestone.

## Process boundary

`orbitforge-web` and `orbitforge-worker` are separate processes and future system users. They communicate only through `/run/orbitforge/worker.sock`; the shared `orbitforge` group grants socket access and no broader hardware permission.

The web process binds to `127.0.0.1` and owns `/var/lib/orbitforge/web/orbitforge.db`. The worker never opens or writes the database. `/api/readiness` is same-origin and intentionally unauthenticated in Milestone 1. Authentication and roles are deferred without placeholder middleware.

## External systems

SatDump remains independently managed and observation-only. OrbitForge must not stop, restart, duplicate, reconfigure, or invoke `satdump-autotrack.service`. Probes must not open the RTL-SDR or run `rtl_test`.

GPS/PPS is optional unless an operator explicitly marks it required. A Rotcld connection error is informational or degraded when no rotator is configured.

Storage readiness reports writability and capacity. More than 20 GB free is healthy, 10–20 GB is warning, and less than 10 GB is critical. Milestone 1 never deletes SatDump products or changes ownership or retention policy.

## Deployment paths

- Development: `/home/vaggos/orbitforge`
- Releases: `/opt/orbitforge/releases/<version>`
- Active release: `/opt/orbitforge/current`
- Runtime state: `/var/lib/orbitforge`
- SQLite: `/var/lib/orbitforge/web/orbitforge.db`
