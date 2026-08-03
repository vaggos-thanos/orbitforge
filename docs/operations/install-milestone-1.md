# Milestone 1 installation runbook

These are operator commands, not an automated installer. Review the release and
environment values before running them. They do not install packages, alter
SatDump, change RF drivers, or expose the web service beyond localhost.

## Preconditions

- Node.js 24 LTS is available at the reviewed server path
  `/usr/local/bin/node`.
- The reviewed release has been built and copied to
  `/opt/orbitforge/releases/<version>`.
- `apps/web/.output/server/index.mjs` and `apps/worker/dist/main.mjs` exist in
  that release.
- `/home/vaggos/autotracking_config.json` remains the independently managed
  SatDump configuration.

## Review and validate templates

From the release checkout:

```bash
systemd-analyze verify deploy/systemd/orbitforge-web.service deploy/systemd/orbitforge-worker.service
systemd-analyze security --offline=yes deploy/systemd/orbitforge-web.service
systemd-analyze security --offline=yes deploy/systemd/orbitforge-worker.service
```

## Install identities and directories

```bash
sudo install -m 0644 deploy/systemd/orbitforge.sysusers /usr/lib/sysusers.d/orbitforge.conf
sudo systemd-sysusers /usr/lib/sysusers.d/orbitforge.conf
sudo install -m 0644 deploy/systemd/orbitforge.tmpfiles /usr/lib/tmpfiles.d/orbitforge.conf
sudo systemd-tmpfiles --create /usr/lib/tmpfiles.d/orbitforge.conf
```

Confirm the result before proceeding:

```bash
getent passwd orbitforge-web orbitforge-worker
getent group orbitforge
stat -c '%U:%G %a %n' /run/orbitforge /var/lib/orbitforge/web
```

## Configure the local services

Create `/etc/orbitforge` as root with mode `0750`, then create these root-owned,
mode `0640` files. Replace the example identifiers with approved stable values.

`/etc/orbitforge/web.env`:

```text
ORBITFORGE_NODE_ID=node-1
```

`/etc/orbitforge/worker.env`:

```text
ORBITFORGE_STATION_ID=station-1
ORBITFORGE_NODE_ID=node-1
ORBITFORGE_WORKER_ID=worker-1
```

Do not place credentials, station coordinates, or SatDump configuration content
in either environment file.

## Activate a reviewed release

Replace `<version>` below with the exact reviewed release directory name.

```bash
sudo ln -sfn /opt/orbitforge/releases/<version> /opt/orbitforge/current
sudo install -m 0644 deploy/systemd/orbitforge-web.service /etc/systemd/system/orbitforge-web.service
sudo install -m 0644 deploy/systemd/orbitforge-worker.service /etc/systemd/system/orbitforge-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now orbitforge-worker.service orbitforge-web.service
```

The units have no dependency on `satdump-autotrack.service`; do not stop,
restart, enable, disable, replace, or reconfigure that service.

## Verify

```bash
systemctl --no-pager --full status orbitforge-worker.service orbitforge-web.service
journalctl -u orbitforge-worker.service -u orbitforge-web.service --since=-10min --no-pager
stat -c '%U:%G %a %n' /run/orbitforge/worker.sock /var/lib/orbitforge/web/orbitforge.db
curl --fail --silent http://127.0.0.1:3000/api/readiness
ss -ltn | grep '127.0.0.1:3000'
```

Expected ownership is `orbitforge-worker:orbitforge 660` for the socket and
`orbitforge-web:orbitforge-web` for SQLite. A missing optional GPS/PPS source or
rotcld without a configured rotator must not make the whole station critical.

Installation remains a separately approved operational action. Never repair
ownership, retention, or permissions under `/home/vaggos/satdump_out` from an
OrbitForge package script or service.
