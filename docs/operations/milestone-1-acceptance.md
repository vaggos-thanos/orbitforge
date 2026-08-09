# Milestone 1 acceptance record

Date: 2026-08-03  
Result: **PASS** for the reviewed local readiness slice. Deployment remains a
separate owner-approved operation; no OrbitForge units or system users were
installed during acceptance.

## Verified environment

- Debian GNU/Linux 12 (bookworm)
- Linux `6.12.43+deb12-amd64`, x86_64
- Node.js `v24.18.1` at `/usr/local/bin/node`
- pnpm `11.18.0`, pinned in `package.json`
- Git `2.39.5`
- systemd `252 (252.38-1~deb12u1)`

## Reproducible quality gate

From `/home/vaggos/orbitforge` on the development server:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
systemd-analyze verify \
  deploy/systemd/orbitforge-web.service \
  deploy/systemd/orbitforge-worker.service
```

Results:

- Supply-chain policy checked all 826 lockfile entries.
- Prettier, ESLint flat config, and all strict TypeScript checks passed.
- 13 Vitest files passed, 73 tests passed.
- The explicit migration CLI created a temporary database, applied the checked-in
  migration once, recorded its SHA-256 checksum, and made a second run a no-op.
- The worker produced `apps/worker/dist/main.cjs`.
- Nuxt produced the Node server under `apps/web/.output`.
- Both systemd units parsed successfully.
- Sysusers and tmpfiles templates were applied successfully inside an isolated
  temporary root. Nothing was installed into host identity or unit directories.

## Read-only staging probe

A temporary worker used `/tmp/orbitforge-acceptance-worker.sock` and the built
production artifact. One `readiness.get` request returned a validated schema
`1.0` snapshot:

- system: healthy
- storage: healthy, writable, 43.5 GiB free, healthy capacity threshold
- time: healthy, NTP synchronized; GPS/PPS not required
- SDR inventory: healthy, one device observed through USB enumeration
- SatDump: healthy, active and enabled, no rotator configured

The temporary process and every acceptance file were removed afterward. The
probe did not execute SatDump or `rtl_test`, initialize an RTL-SDR, or claim the
receiver; SDR discovery was limited to `lsusb` enumeration.

## Non-mutation evidence

Before and after the staging request:

- `/home/vaggos/autotracking_config.json` retained SHA-256
  `be3de8699bb815a10f1b15f24720eb5604dc72f492ecceb04bb1b2f493d52ccc`.
- `satdump-autotrack.service` retained PID `3084`, zero restarts, and start time
  `2026-08-03 03:49:03 EEST`; it remained active/running as `vaggos:vaggos`.
- `/home/vaggos/satdump_out` remained `vaggos:vaggos` mode `0755`.
- No `orbitforge-web` or `orbitforge-worker` host user, installed OrbitForge
  unit, or listener on port 3000/3100 existed.

An artifact audit scanned 315 worker/web production files. The live SatDump
configuration contained two coordinate fields; neither value appeared in an
artifact. No private-key, GitHub-token, AWS-key, or bearer-token pattern was
found.

## Negative requirements verified

- No SatDump configuration or service change.
- No SatDump process launch, stop, restart, replacement, or duplicate.
- No `rtl_test`, RTL-SDR initialization/claim, driver change, module blacklist,
  udev change, or `dialout` membership change.
- No automatic output deletion, retention change, or ownership repair.
- No public OrbitForge listener or newly installed remote service.
- No worker access to SQLite.
- No authentication placeholder or partial role model.
- No scheduling, mission execution, RF topology editing, or SatDump control.

## Known limitations and deferrals

- One station and one node are represented.
- USB inventory observes one SDR; it does not claim or exercise the receiver.
- Time readiness covers NTP. GPS/PPS remains optional and unimplemented.
- Rotcld is not contacted when no rotator is configured.
- The live readiness probe reports SatDump service/config state but does not yet
  populate the parsed SatDump version field.
- SQLite uses Drizzle `1.0.0-rc.4` and Node 24 `node:sqlite`; review stable
  releases before a production milestone.
- Authentication/roles, browser E2E coverage, scheduling, resource reservation,
  missions, product management, remote storage, and SatDump control are deferred.
