<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { StatusBadge } from '@orbitforge/ui'
import type { HealthStatus, ReadinessSnapshot } from '@orbitforge/contracts'

import { useReadinessStore } from '../stores/readiness.js'

const store = useReadinessStore()
const { error, pending, response } = storeToRefs(store)
const now = ref(new Date())
let clock: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clock = setInterval(() => {
    now.value = new Date()
  }, 1_000)
  if (response.value === null) void store.refresh()
})

onBeforeUnmount(() => {
  if (clock !== undefined) clearInterval(clock)
})

const utcTime = computed(() =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(now.value),
)

const statusOrder: Record<HealthStatus, number> = {
  healthy: 0,
  unknown: 1,
  degraded: 2,
  unavailable: 3,
}

const overallStatus = computed<HealthStatus>(() => {
  const snapshot = response.value?.snapshot
  if (snapshot === undefined) return 'unknown'
  return [
    snapshot.system.status,
    snapshot.storage.status,
    snapshot.time.status,
    snapshot.sdr.status,
    snapshot.satdump.status,
  ].reduce((current, status) =>
    statusOrder[status] > statusOrder[current] ? status : current,
  )
})

const overallSummary = computed(() => {
  switch (overallStatus.value) {
    case 'healthy':
      return 'All readiness checks are healthy. No action is required.'
    case 'degraded':
      return 'Review the degraded checks below before the next pass.'
    case 'unavailable':
      return 'One or more required checks are unavailable.'
    case 'unknown':
      return 'Readiness has not been established yet.'
    default:
      return 'Readiness has not been established yet.'
  }
})

interface ReadinessRow {
  readonly name: string
  readonly status: HealthStatus
  readonly summary: string
  readonly detail: string
}

function gibibytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function rows(snapshot: ReadinessSnapshot): readonly ReadinessRow[] {
  return [
    {
      name: 'System',
      status: snapshot.system.status,
      summary: snapshot.system.summary,
      detail: `${snapshot.system.architecture} · ${snapshot.system.cpuCount} logical CPUs`,
    },
    {
      name: 'Storage',
      status: snapshot.storage.status,
      summary: snapshot.storage.summary,
      detail: `${gibibytes(snapshot.storage.freeBytes)} free · ${snapshot.storage.writable ? 'Writable' : 'Not writable'}`,
    },
    {
      name: 'Time synchronization',
      status: snapshot.time.status,
      summary: snapshot.time.summary,
      detail: `${snapshot.time.synchronized ? 'Synchronized' : 'Not synchronized'} · ${snapshot.time.source.toUpperCase()}`,
    },
    {
      name: 'SDR devices',
      status: snapshot.sdr.status,
      summary: snapshot.sdr.summary,
      detail: `${snapshot.sdr.devices.length} detected`,
    },
    {
      name: 'SatDump',
      status: snapshot.satdump.status,
      summary: snapshot.satdump.summary,
      detail: `${snapshot.satdump.version ?? 'Version unavailable'} · ${snapshot.satdump.serviceActive ? 'Service active' : 'Service inactive'}`,
    },
  ]
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="identity">
        <strong class="brand">OrbitForge</strong>
        <span class="station">
          {{ response?.snapshot.nodeId ?? 'Station unavailable' }}
        </span>
      </div>
      <div class="topbar__actions">
        <time class="utc-time">UTC {{ utcTime }}</time>
        <button
          class="refresh-button"
          type="button"
          :disabled="pending"
          @click="store.refresh"
        >
          {{ pending ? 'Refreshing…' : 'Refresh readiness' }}
        </button>
      </div>
    </header>

    <main class="workspace">
      <h1>Station readiness</h1>
      <p class="lede">Live health from the local OrbitForge worker</p>

      <p v-if="response?.notice" class="notice" role="status">
        {{ response.notice }}
      </p>

      <section v-if="response" aria-labelledby="overall-heading">
        <div class="overall" :data-status="overallStatus">
          <div>
            <p id="overall-heading" class="overall__label">Overall status</p>
            <StatusBadge :status="overallStatus" />
          </div>
          <p class="overall__summary">
            {{ overallSummary }}
          </p>
        </div>

        <div class="readiness-list" aria-label="Readiness checks">
          <article
            v-for="row in rows(response.snapshot)"
            :key="row.name"
            class="readiness-row"
            data-readiness-row
          >
            <h2>{{ row.name }}</h2>
            <div>
              <StatusBadge :status="row.status" />
              <p class="row-summary">
                {{ row.summary }}
              </p>
              <p class="row-detail">
                {{ row.detail }}
              </p>
            </div>
          </article>
        </div>

        <footer class="metadata">
          <span>
            <strong>Observed</strong>
            <time>{{ response.snapshot.observedAt }}</time>
          </span>
          <span><strong>Worker</strong> {{ response.snapshot.workerId }}</span>
        </footer>
      </section>

      <section v-else-if="error" class="unavailable" role="alert">
        <h2>Readiness unavailable</h2>
        <p>{{ error }}</p>
        <p>Confirm the local worker service and Unix socket are available.</p>
      </section>

      <p v-else class="loading" role="status">Collecting station readiness…</p>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  background: var(--surface-page);
}

.topbar {
  min-height: 5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-4) clamp(var(--space-4), 4vw, var(--space-12));
  border-bottom: 1px solid var(--border-subtle);
}

.identity,
.topbar__actions,
.metadata span {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.brand {
  font-size: 1.5rem;
  letter-spacing: -0.035em;
}

.station,
.utc-time,
.row-detail,
.metadata {
  color: var(--text-secondary);
}

.station {
  padding-left: var(--space-6);
  border-left: 1px solid var(--border-subtle);
}

.utc-time,
.metadata {
  font-variant-numeric: tabular-nums;
}

.refresh-button {
  min-height: 2.75rem;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-small);
  background: var(--surface-raised);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 700;
}

.refresh-button:hover:not(:disabled) {
  border-color: var(--focus-ring);
}

.refresh-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.workspace {
  width: min(84rem, calc(100% - 2 * var(--space-8)));
  margin: 0 auto;
  padding: clamp(var(--space-8), 4vw, var(--space-12)) 0;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: var(--space-2);
  font-size: clamp(2rem, 4vw, 3.25rem);
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.lede {
  margin-bottom: var(--space-8);
  color: var(--text-secondary);
  font-size: 1.125rem;
}

.notice,
.unavailable {
  margin-bottom: var(--space-6);
  padding: var(--space-4) var(--space-6);
  border-left: 0.25rem solid var(--status-degraded);
  background: var(--surface-raised);
}

.overall {
  display: grid;
  grid-template-columns: minmax(14rem, 0.7fr) 1.3fr;
  align-items: center;
  gap: var(--space-8);
  margin-bottom: var(--space-8);
  padding: var(--space-6);
  border: 1px solid var(--border-subtle);
  border-left: 0.25rem solid var(--status-healthy);
  background: var(--surface-raised);
}

.overall[data-status='degraded'] {
  border-left-color: var(--status-degraded);
}

.overall[data-status='unavailable'] {
  border-left-color: var(--status-unavailable);
}

.overall[data-status='unknown'] {
  border-left-color: var(--status-unknown);
}

.overall__label {
  margin-bottom: var(--space-2);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.overall__summary,
.row-summary,
.row-detail {
  min-width: 0;
  margin-bottom: 0;
  overflow-wrap: anywhere;
}

.readiness-list {
  border-top: 1px solid var(--border-subtle);
}

.readiness-row {
  display: grid;
  grid-template-columns: minmax(14rem, 0.7fr) 1.3fr;
  gap: var(--space-8);
  padding: 1.125rem var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.readiness-row > div {
  display: grid;
  grid-template-columns: 7rem 1fr;
  align-items: baseline;
  gap: var(--space-1) var(--space-4);
}

.readiness-row h2 {
  margin-bottom: 0;
  font-size: 1rem;
}

.row-summary {
  margin-top: 0;
  line-height: 1.5;
}

.row-detail {
  grid-column: 2;
  margin-top: 0;
  font-size: 0.875rem;
}

.metadata {
  display: flex;
  justify-content: space-between;
  gap: var(--space-6);
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border-subtle);
  font-size: 0.8125rem;
}

.metadata strong {
  color: var(--text-primary);
}

.unavailable {
  border-left-color: var(--status-unavailable);
}

.loading {
  color: var(--text-secondary);
}

@media (max-width: 44rem) {
  .topbar,
  .identity,
  .topbar__actions,
  .metadata,
  .metadata span {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-3);
  }

  .station {
    padding-left: 0;
    border-left: 0;
  }

  .workspace {
    width: min(calc(100% - 2 * var(--space-4)), 76rem);
  }

  .overall,
  .readiness-row {
    display: block;
    width: 100%;
  }

  .readiness-row > div {
    display: block;
    width: 100%;
    min-width: 0;
    margin-top: var(--space-4);
  }

  .overall__summary,
  .row-summary,
  .row-detail {
    width: 100%;
    max-width: 100%;
    white-space: normal;
  }

  .overall__summary {
    margin-top: var(--space-4);
  }

  .row-summary {
    margin-top: var(--space-2);
  }

  .row-detail {
    margin-top: var(--space-1);
  }
}
</style>
