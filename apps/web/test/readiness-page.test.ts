// @vitest-environment happy-dom

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import IndexPage from '../app/pages/index.vue'
import { useReadinessStore } from '../app/stores/readiness.js'
import StatusBadge from '../../../packages/ui/src/StatusBadge.vue'
import { readinessSnapshot } from './fixture.js'

describe('readiness UI', () => {
  it('renders status as accessible text rather than color alone', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'degraded' },
    })

    expect(wrapper.text()).toBe('Degraded')
    expect(wrapper.attributes('aria-label')).toBe('Status: Degraded')
    expect(wrapper.attributes('data-status')).toBe('degraded')
  })

  it('shows actionable degraded-state details on the readiness page', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useReadinessStore(pinia)
    const base = readinessSnapshot()
    store.response = {
      source: 'live',
      notice: null,
      snapshot: {
        ...base,
        storage: {
          ...base.storage,
          status: 'degraded',
          summary: '15 GB free; plan capacity before the next pass.',
          capacityState: 'warning',
          freeBytes: 15 * 1024 ** 3,
        },
      },
    }

    const wrapper = mount(IndexPage, { global: { plugins: [pinia] } })

    expect(wrapper.get('h1').text()).toBe('Station readiness')
    expect(wrapper.text()).toContain('Degraded')
    expect(wrapper.text()).toContain(
      '15 GB free; plan capacity before the next pass.',
    )
    expect(wrapper.findAll('[data-readiness-row]')).toHaveLength(5)
  })

  it('defines visible focus and reduced-motion behavior', async () => {
    const tokens = await readFile(
      join(process.cwd(), 'packages/ui/src/tokens.css'),
      'utf8',
    )

    expect(tokens).toContain(':focus-visible')
    expect(tokens).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
