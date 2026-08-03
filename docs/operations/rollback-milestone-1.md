# Milestone 1 rollback runbook

Rollback changes only OrbitForge. It must not stop, restart, replace, or modify
`satdump-autotrack.service`, its configuration, or RF hardware.

## Roll back to a previous release

Identify the last reviewed release under `/opt/orbitforge/releases`, then:

```bash
sudo systemctl stop orbitforge-web.service orbitforge-worker.service
sudo ln -sfn /opt/orbitforge/releases/<previous-version> /opt/orbitforge/current
sudo systemctl start orbitforge-worker.service orbitforge-web.service
curl --fail --silent http://127.0.0.1:3000/api/readiness
```

Do not reuse a newer SQLite database with an older release unless that release's
migration notes explicitly state it is compatible. Before any database restore,
stop `orbitforge-web.service`; the web process is the exclusive database writer.

## Disable Milestone 1 services

```bash
sudo systemctl disable --now orbitforge-web.service orbitforge-worker.service
sudo systemctl reset-failed orbitforge-web.service orbitforge-worker.service
```

Service logs remain in the systemd journal. Runtime socket files under
`/run/orbitforge` are ephemeral. Preserve `/var/lib/orbitforge/web/orbitforge.db`
unless the owner separately approves its removal.

Do not remove service users, the `orbitforge` group, state, unit files, or release
directories as part of an incident rollback. Those are separate destructive
operations requiring explicit owner approval.
