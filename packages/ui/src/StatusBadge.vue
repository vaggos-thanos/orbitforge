<script setup lang="ts">
import { computed } from 'vue'

import type { HealthStatus } from '@orbitforge/contracts'

const props = defineProps<{ readonly status: HealthStatus }>()

const labels: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unavailable: 'Unavailable',
  unknown: 'Unknown',
}
const label = computed(() => labels[props.status])
</script>

<template>
  <span
    class="of-status"
    :data-status="status"
    role="status"
    :aria-label="`Status: ${label}`"
  >
    <span class="of-status__marker" aria-hidden="true" />
    {{ label }}
  </span>
</template>
