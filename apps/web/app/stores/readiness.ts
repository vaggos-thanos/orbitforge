import { defineStore } from 'pinia'

import type { ReadinessApiResponse } from '../../shared/readiness.js'

interface ReadinessState {
  response: ReadinessApiResponse | null
  pending: boolean
  error: string | null
}

export const useReadinessStore = defineStore('readiness', {
  state: (): ReadinessState => ({
    response: null,
    pending: false,
    error: null,
  }),
  actions: {
    async refresh(): Promise<void> {
      this.pending = true
      this.error = null
      try {
        this.response = await $fetch<ReadinessApiResponse>('/api/readiness')
      } catch {
        this.error =
          'The local worker could not be reached and no cached readiness snapshot is available.'
      } finally {
        this.pending = false
      }
    },
  },
})
