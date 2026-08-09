# OrbitForge Milestone 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a tested pnpm monorepo and a read-only, local-only station-readiness vertical slice without changing the existing SatDump installation or taking control of RF hardware.

**Architecture:** A Nuxt web process and a separate TypeScript worker communicate through versioned Zod contracts over `/run/orbitforge/worker.sock`. The worker exposes allowlisted read-only probes for system, time, storage, USB/SDR, and SatDump state; the web process presents a minimal readiness view and exclusively owns `/var/lib/orbitforge/web/orbitforge.db`. SatDump remains an independently managed external service and is observed, never reconfigured, by Milestone 1.

**Tech Stack:** Node.js 24 LTS, Nuxt 4, Vue 3, strict TypeScript, Nitro, Pinia, Tailwind, Node TypeScript worker, Zod, Drizzle, SQLite, Pino, execa, pnpm, Vitest, Vue Test Utils, ESLint flat config, Prettier, and systemd. Playwright is deferred until browser E2E coverage becomes necessary.

## Global Constraints

- Preserve `/home/vaggos/autotracking_config.json` byte-for-byte unless the owner separately approves a later change.
- Do not replace, restart, stop, or duplicate `satdump-autotrack.service`.
- Do not change SDR drivers, udev rules, groups, kernel modules, or device ownership in Milestone 1.
- Bind the web service to `127.0.0.1` only and expose readiness through the same-origin `/api/readiness` route.
- Do not implement placeholder or partial authentication; authentication and roles are deferred.
- The worker transport is `/run/orbitforge/worker.sock`, accessible only to `orbitforge-web`, `orbitforge-worker`, and the shared `orbitforge` socket group.
- Do not require Docker, Kubernetes, PostgreSQL, SFTP, cloud services, or arbitrary shell execution.
- SatDump is the only V1 production module; the module SDK remains internal.
- Web and worker have separate systemd units and permission profiles.
- Every probe result carries a timestamp, source identity, confidence/status, and actionable error details.
- High-frequency telemetry, scheduling, mission execution, device reservation, and SatDump process launch are outside Milestone 1.
- GPS/PPS absence is not a readiness failure unless GPS/PPS is explicitly configured as required.
- Rotcld failure is informational or degraded when no rotator is configured; it is not station-wide critical.
- Storage readiness is healthy above 20 GB free, warning from 10 GB through 20 GB, and critical below 10 GB.
- Never delete SatDump products or silently change output ownership or retention policy.
- Development checkout is `/home/vaggos/orbitforge`; future releases use `/opt/orbitforge/releases/<version>` with `/opt/orbitforge/current` as the active symlink.

## Proposed File Map

```text
apps/
  web/                       Nuxt UI, REST, browser WebSocket, readiness presentation
  worker/                    Unix-socket server and read-only host probes
packages/
  contracts/                 Protocol envelope and readiness schemas
  domain/                    Station, node, worker, resource, capability, health types
  database/                  Drizzle schema, migrations, and web-owned repository API
  observability/             Pino configuration, redaction, correlation helpers
  satdump-adapter/           Pure parsing and read-only SatDump inspection
  config/                    Typed environment configuration shared by web and worker
  ui/                        Semantic tokens and small reusable Vue components
  test-utils/                Fixtures and protocol test helpers
deploy/systemd/              Reviewed unit templates; not installed automatically
docs/architecture/           Boundaries, data flow, failure modes, security model
docs/operations/             Installation, rollback, and verification runbooks
```

---

### Task 1: Repository contract and workspace baseline

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `pnpm-lock.yaml`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `docs/architecture/0001-milestone-1-boundaries.md`
- Create: `docs/operations/development.md`

**Interfaces:**

- Consumes: Node.js 24 LTS and the latest stable pnpm at bootstrap, pinned exactly in `packageManager`; Vitest, Vue Test Utils, ESLint flat config, and Prettier.
- Produces: root scripts `build`, `test`, `typecheck`, `lint`, and `check`; workspace package naming under `@orbitforge/*`.

- [ ] **Step 1: Record the approved runtime and architecture decisions** in `docs/architecture/0001-milestone-1-boundaries.md`, including Unix socket transport, web-owned SQLite, localhost-only web binding, deferred authentication, and the explicit non-goals above.
- [ ] **Step 2: Write a failing workspace smoke test** that asserts every workspace package has a unique `@orbitforge/*` name and `typecheck` script.
- [ ] **Step 3: Run the smoke test** and verify it fails because workspace manifests do not yet exist.
- [ ] **Step 4: Add the minimal root workspace configuration** and package manifests needed to satisfy the smoke test; pin exact dependency versions in `pnpm-lock.yaml`.
- [ ] **Step 5: Run `pnpm check`** and require lint, typecheck, and tests to pass from the root.
- [ ] **Step 6: Commit** with `chore: establish pnpm workspace contract`.

### Task 2: Versioned protocol and domain primitives

**Files:**

- Create: `packages/contracts/src/envelope.ts`
- Create: `packages/contracts/src/readiness.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/envelope.test.ts`
- Create: `packages/domain/src/identity.ts`
- Create: `packages/domain/src/resources.ts`
- Create: `packages/domain/src/health.ts`
- Create: `packages/domain/src/index.ts`

**Interfaces:**

- Consumes: Zod and the SPEC-004 envelope.
- Produces: `ProtocolEnvelopeSchema`, `ReadinessSnapshotSchema`, `StationId`, `NodeId`, `WorkerId`, `ResourceHealth`, and inferred TypeScript types.

- [ ] **Step 1: Write failing contract tests** for protocol version `1.0`, UUID message/correlation IDs, ISO-8601 timestamps, source IDs, unknown-field rejection, and invalid health-state rejection.
- [ ] **Step 2: Run the contract tests** and verify they fail because the schemas are absent.
- [ ] **Step 3: Implement the minimal Zod schemas** with health states `healthy`, `degraded`, `unavailable`, and `unknown`; model uncertainty explicitly rather than substituting guessed values.
- [ ] **Step 4: Add round-trip fixtures** for system, storage, time, SDR, and SatDump readiness sections.
- [ ] **Step 5: Run package tests and typecheck** and require all fixtures to parse without widening to `any`.
- [ ] **Step 6: Commit** with `feat: define readiness protocol contracts`.

### Task 3: Safe configuration and observability packages

**Files:**

- Create: `packages/config/src/web.ts`
- Create: `packages/config/src/worker.ts`
- Create: `packages/config/test/config.test.ts`
- Create: `packages/observability/src/logger.ts`
- Create: `packages/observability/src/correlation.ts`
- Create: `packages/observability/test/redaction.test.ts`

**Interfaces:**

- Consumes: Zod, Pino, environment variables.
- Produces: `loadWebConfig(env)`, `loadWorkerConfig(env)`, `createLogger(options)`, and `withCorrelationId(id)`.

- [ ] **Step 1: Write failing tests** proving defaults bind web to `127.0.0.1`, use `/run/orbitforge/worker.sock`, reject `0.0.0.0`, and redact tokens, authorization headers, cookies, and configured station coordinates without adding authentication behavior.
- [ ] **Step 2: Run tests** and verify failures identify the missing loaders and redaction rules.
- [ ] **Step 3: Implement strict configuration schemas** with no silent fallback for paths or authentication secrets.
- [ ] **Step 4: Implement structured logging** with service, node, worker, request, job, and correlation fields.
- [ ] **Step 5: Run tests and typecheck** and inspect one JSON log fixture for correct redaction.
- [ ] **Step 6: Commit** with `feat: add safe runtime configuration and logging`.

### Task 4: Pure SatDump adapter

**Files:**

- Create: `packages/satdump-adapter/src/config.ts`
- Create: `packages/satdump-adapter/src/version.ts`
- Create: `packages/satdump-adapter/src/service.ts`
- Create: `packages/satdump-adapter/src/output.ts`
- Create: `packages/satdump-adapter/src/index.ts`
- Create: `packages/satdump-adapter/test/fixtures/autotracking_config.json`
- Create: `packages/satdump-adapter/test/fixtures/startup.log`
- Create: `packages/satdump-adapter/test/adapter.test.ts`

**Interfaces:**

- Consumes: copied, sanitized fixtures; it never writes a SatDump path.
- Produces: `parseAutotrackingConfig(text)`, `parseSatDumpVersion(logText)`, `parseSatDumpUnit(showOutput)`, and `summarizeOutputDirectory(entries)`.

- [ ] **Step 1: Write failing parser tests** for SatDump `v1.2.3-943de7df0`, RTL-SDR source, sample rate, configured output path, listener address, tracked NORAD IDs, invalid JSON, and missing fields.
- [ ] **Step 2: Run tests** and verify the parser functions are missing.
- [ ] **Step 3: Implement pure parsers** that return typed success/error results and never normalize by rewriting input.
- [ ] **Step 4: Add tests for ownership and writability warnings** using synthetic stat data representing root-owned `0755` output with a non-root service user.
- [ ] **Step 5: Run tests and typecheck** with the real configuration path absent from test code except as a string fixture value.
- [ ] **Step 6: Commit** with `feat: add read-only SatDump inspection adapter`.

### Task 5: Worker read-only probe layer

**Files:**

- Create: `apps/worker/src/probes/runner.ts`
- Create: `apps/worker/src/probes/system.ts`
- Create: `apps/worker/src/probes/storage.ts`
- Create: `apps/worker/src/probes/time.ts`
- Create: `apps/worker/src/probes/usb.ts`
- Create: `apps/worker/src/probes/satdump.ts`
- Create: `apps/worker/src/readiness.ts`
- Create: `apps/worker/test/probes.test.ts`

**Interfaces:**

- Consumes: `execa`, `ReadinessSnapshotSchema`, SatDump parsers, and an injected `CommandRunner`.
- Produces: `collectReadinessSnapshot(context): Promise<ReadinessSnapshot>`, including output writability and healthy/warning/critical disk-capacity classification.

- [ ] **Step 1: Write failing tests with a fake `CommandRunner`** for command timeouts, missing binaries, malformed output, partial probe failure, and SatDump being active without touching a real device.
- [ ] **Step 2: Run tests** and verify no probe implementation exists.
- [ ] **Step 3: Implement an explicit command allowlist** for `uname`, `lscpu`, `free`, `df`, `lsusb`, `timedatectl`, `systemctl show`, `stat`, and `ss`; reject arbitrary executable names and arguments.
- [ ] **Step 4: Implement bounded parallel probes** with per-command timeouts, output-size caps, timestamps, degraded/unknown states on failure, optional GPS/PPS semantics, and informational Rotcld failure when no rotator is configured.
- [ ] **Step 5: Add a regression test** proving the worker never calls `rtl_test`, opens USB devices, invokes SatDump pipelines, uses sudo, or writes configuration.
- [ ] **Step 6: Run tests, lint, and typecheck**, then commit with `feat: collect read-only station readiness`.

### Task 6: Local worker protocol server

**Files:**

- Create: `apps/worker/src/server/socket.ts`
- Create: `apps/worker/src/server/router.ts`
- Create: `apps/worker/src/main.ts`
- Create: `apps/worker/test/socket.integration.test.ts`
- Create: `docs/architecture/0002-web-worker-protocol.md`

**Interfaces:**

- Consumes: `collectReadinessSnapshot`, protocol schemas, `/run/orbitforge/worker.sock`.
- Produces: request type `readiness.get`, response type `readiness.snapshot`, heartbeat type `worker.heartbeat`, and structured protocol errors.

- [ ] **Step 1: Write a failing socket integration test** in a temporary directory for valid readiness requests, invalid protocol versions, oversized frames, stale heartbeat detection, and correlation-ID preservation.
- [ ] **Step 2: Run the test** and verify connection failure because the server is absent.
- [ ] **Step 3: Implement length-bounded newline-delimited JSON framing** over a Unix socket with Zod validation on both ingress and egress.
- [ ] **Step 4: Set restrictive socket permissions** in the test harness and document the approved `orbitforge` group without creating it on the server during application bootstrap.
- [ ] **Step 5: Run integration tests under concurrent requests** and ensure one failed probe does not terminate the server.
- [ ] **Step 6: Commit** with `feat: expose readiness over local worker socket`.

### Task 7: SQLite persistence owned by web

**Files:**

- Create: `packages/database/src/schema/readiness.ts`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/readiness-repository.ts`
- Create: `packages/database/drizzle.config.ts`
- Create: `packages/database/test/readiness-repository.test.ts`

**Interfaces:**

- Consumes: Drizzle, SQLite at `/var/lib/orbitforge/web/orbitforge.db`, and validated `ReadinessSnapshot` values; only the web process imports this package at runtime.
- Produces: `saveReadinessSnapshot(snapshot)`, `getLatestReadinessSnapshot(nodeId)`, and migration files checked into source control.

- [ ] **Step 1: Write failing repository tests** using a temporary SQLite file for insert/read, ordering, corrupted JSON rejection, and bounded retention.
- [ ] **Step 2: Run tests** and verify the schema/repository are absent.
- [ ] **Step 3: Implement the minimal append-only readiness table** with node ID, observed timestamp, status summary, schema version, and validated JSON payload.
- [ ] **Step 4: Generate and inspect the migration**; reject runtime auto-migration in production.
- [ ] **Step 5: Run repository tests twice** to prove clean creation and idempotent migration behavior.
- [ ] **Step 6: Commit** with `feat: persist readiness snapshots`.

### Task 8: Minimal Nuxt readiness vertical slice

**Files:**

- Create: `apps/web/nuxt.config.ts`
- Create: `apps/web/server/utils/worker-client.ts`
- Create: `apps/web/server/api/readiness.get.ts`
- Create: `apps/web/stores/readiness.ts`
- Create: `apps/web/pages/index.vue`
- Create: `packages/ui/src/tokens.css`
- Create: `packages/ui/src/StatusBadge.vue`
- Create: `apps/web/test/readiness-api.test.ts`
- Create: `apps/web/test/readiness-page.test.ts`

**Interfaces:**

- Consumes: worker socket responses, database repository, semantic UI tokens.
- Produces: same-origin, unauthenticated server API `/api/readiness` and a keyboard-accessible readiness page showing station, SatDump, SDR, time, and storage states.

- [ ] **Step 1: Write failing API tests** for a healthy snapshot, worker unavailable, stale data fallback, schema mismatch, and no leakage of configuration content or coordinates; tests must also prove no placeholder authentication middleware exists.
- [ ] **Step 2: Write failing component tests** for non-color-only status labels, visible focus, reduced motion, and actionable degraded-state text.
- [ ] **Step 3: Implement the worker client and API route** with bounded timeouts and last-known snapshot fallback.
- [ ] **Step 4: Implement the smallest dashboard page** needed to answer readiness questions; omit globe, scheduler, receiver, gallery, and mission controls.
- [ ] **Step 5: Run API/component tests, production build, and accessibility checks** and capture expected localhost-only start output.
- [ ] **Step 6: Commit** with `feat: present station readiness vertical slice`.

### Task 9: Hardened systemd templates and operator runbook

**Files:**

- Create: `deploy/systemd/orbitforge-web.service`
- Create: `deploy/systemd/orbitforge-worker.service`
- Create: `deploy/systemd/orbitforge.tmpfiles`
- Create: `deploy/systemd/orbitforge.sysusers`
- Create: `docs/operations/install-milestone-1.md`
- Create: `docs/operations/rollback-milestone-1.md`
- Create: `test/systemd/security.test.ts`

**Interfaces:**

- Consumes: built web/worker entry points and owner-approved users/groups/paths.
- Produces: templates only; installation remains a separately approved operator action.

- [ ] **Step 1: Write failing static tests** requiring separate users, localhost-only web binding, restrictive socket mode, `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`, explicit writable paths, restart limits, and no dependency/conflict with `satdump-autotrack.service`.
- [ ] **Step 2: Run tests** and verify unit templates are absent.
- [ ] **Step 3: Write unit templates** for `orbitforge-web.service` and `orbitforge-worker.service` using the approved system users, shared socket group, release/current paths, runtime-state paths, localhost web binding, and systemd journal logging.
- [ ] **Step 4: Document exact install, verify, and rollback commands** while keeping installation outside automated package scripts.
- [ ] **Step 5: Run `systemd-analyze verify` in a disposable Linux CI environment** and run the static security tests locally.
- [ ] **Step 6: Commit** with `docs: add reviewed systemd deployment templates`.

### Task 10: Milestone verification and documentation gate

**Files:**

- Create: `docs/operations/milestone-1-acceptance.md`
- Modify: `README.md`
- Modify: relevant architecture and operations documents from Tasks 1-9

**Interfaces:**

- Consumes: all prior packages and applications.
- Produces: a reproducible acceptance record and explicit deferral list for Milestone 2.

- [ ] **Step 1: Run `pnpm check` from a clean checkout** and record exact tool versions and results.
- [ ] **Step 2: Run production builds** for web and worker and inspect artifacts for bundled secrets or station coordinates.
- [ ] **Step 3: Run socket/API integration tests** with SatDump represented by fixtures, then a separately approved read-only staging probe against the server.
- [ ] **Step 4: Verify negative requirements**: no SatDump/config changes, no USB opens, no sudo, no kernel/udev changes, no public bind, no new remote service, and no main application features beyond readiness.
- [ ] **Step 5: Document known limitations**: one node, one observed SDR, NTP only, no GPS/PPS, no scheduling, no mission execution, no remote storage, and no SatDump control.
- [ ] **Step 6: Commit** with `docs: certify milestone 1 readiness slice`.

## Self-Review Result

- Spec coverage: the plan covers the locked stack, separate services, typed/versioned contracts, local-only transport, observability, SQLite, SatDump reuse, hardware independence, explicit uncertainty, and a small operator-facing readiness slice.
- Intentionally deferred: scheduler, resource reservation, mission execution, RF topology editing, SatDump launching, live telemetry, storage providers, authentication/roles beyond the minimal local API gate, and all V2+ modules.
- Owner decisions were approved on 2026-08-03. Repairing `/home/vaggos/satdump_out` remains a separately logged operational action: record ownership and size immediately before changing it to `vaggos:vaggos`; do not perform that action as application bootstrap.
