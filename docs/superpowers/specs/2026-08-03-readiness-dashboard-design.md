# Milestone 1 readiness dashboard design

## Status

Approved by the owner through the Sprint 0 specification pack, the Milestone 1 Foundation Plan, and the instruction to continue that plan. This document narrows those approvals into the Task 8 implementation surface.

Visual reference: [`../../design/orbitforge-readiness-concept.png`](../../design/orbitforge-readiness-concept.png)

The values in the visual reference are illustrative only. The application must render validated worker or cached snapshot data and must not seed fake station metrics.

## Selected approach

Use a stripped mission-control shell: a small header and one readiness workspace. Do not render placeholder navigation or an empty Mission Rail.

Two alternatives were rejected:

- A full application shell with disabled future modules would create placeholder functionality and weaken the Milestone 1 boundary.
- A generic card-grid dashboard would conflict with SPEC-003's mission-control direction and encourage fake metrics.

## Information architecture

The page contains:

1. A restrained header with OrbitForge identity, station identity, UTC time, and a refresh action.
2. A “Station readiness” heading and short description.
3. One overall readiness summary with explicit text status and actionable degraded-state guidance.
4. An open five-row readiness list for System, Storage, Time synchronization, SDR devices, and SatDump.
5. Observation timestamp and worker identity metadata.

No authentication, roles, globe, scheduler, receiver, tracking control, gallery, mission control, or placeholder navigation is present.

## Data flow

The browser calls only same-origin `GET /api/readiness`. The Nuxt server sends one bounded NDJSON `readiness.get` request to `/run/orbitforge/worker.sock` and validates the response.

On a valid live response, the web process writes the snapshot through `@orbitforge/database` and returns it with `source: "live"`. The worker never imports or opens the database.

If the worker is unavailable or returns invalid data, the route requests the latest validated database snapshot. A cached response is labeled `source: "cached"` with an explanatory warning. If neither live nor cached data is available, the route returns a bounded error without paths, configuration content, coordinates, or raw worker output.

## Visual system

- Dark near-black navy page background; graphite raised surfaces; cool off-white primary text; blue-gray secondary text.
- Semantic tokens for healthy, degraded, unavailable, and unknown states. Domain components never embed raw status colors.
- Status is always expressed by text plus a small geometric marker, never color alone.
- Technical sans-serif typography with tabular numerals for timestamps and metrics.
- An open vertical list with fine separators rather than nested cards or a bento grid.
- A clear `:focus-visible` outline. Motion is nonessential and removed under `prefers-reduced-motion`.

## Responsive behavior

Desktop uses two columns within each readiness row: check identity and status/details. Narrow screens collapse each row into a readable vertical block, keep the refresh control reachable, and preserve all status and remediation text without horizontal scrolling.

## Error and degraded states

- Cached data is visibly identified and includes its observation time.
- An unavailable page explains that the local worker could not be reached and no cached snapshot exists.
- Degraded rows show the probe summary as actionable text.
- GPS/PPS absence is not presented as failure unless configured as required.
- Rotcld failure is not station-critical when no rotator is configured.

## Test strategy

- API tests cover live success, worker unavailable, cached fallback, schema mismatch, redaction, and absence of authentication middleware.
- Vue component tests cover visible non-color-only labels, focus styling, reduced-motion styling, degraded guidance, and responsive semantics.
- A production Nuxt build verifies the Node 24 server bundle.
- Browser verification compares desktop and mobile renders against the visual reference and exercises refresh plus cached/unavailable states.
