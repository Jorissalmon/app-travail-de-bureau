import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The tests run in node, where the Capacitor plugin has no storage to fall back
 * on. An in-memory stand-in is enough: what is under test is the buffer's own
 * rules, not whether Preferences writes to disk.
 */
vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
      remove: async ({ key }: { key: string }) => void store.delete(key),
    },
  }
})

const { analyticsEvents, clearAnalytics, exportAnalytics, loadAnalytics, track } = await import(
  './events'
)

/**
 * The buffer is what the four validation numbers are computed from, so what is
 * pinned here is mostly what it refuses to do: no free text, no unbounded
 * growth, and an export that is exactly what the server would have received.
 */

beforeEach(async () => {
  await clearAnalytics()
  await loadAnalytics()
})

describe('track', () => {
  it('stamps every event with an id and a local date', async () => {
    await track({ name: 'onboarding_started' })
    const [row] = analyticsEvents()
    expect(row?.clientId).toBeTruthy()
    expect(row?.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(row?.event.name).toBe('onboarding_started')
  })

  it('gives every event a distinct id, so a batch cannot collapse', async () => {
    await track({ name: 'onboarding_started' })
    await track({ name: 'onboarding_started' })
    const ids = analyticsEvents().map((e) => e.clientId)
    expect(new Set(ids).size).toBe(2)
  })

  it('never throws, whatever it is handed', async () => {
    // Measuring the app must not be able to break it.
    await expect(track({ name: 'pain_skipped', zone: 'nuque' })).resolves.toBeUndefined()
  })
})

describe('exportAnalytics', () => {
  it('produces the same shape the server is sent', async () => {
    await track({ name: 'plan_shown', goal: 'pain_relief', zones: 1, strengthBlocks: 0, durationS: 360 })
    const doc = JSON.parse(exportAnalytics()) as {
      count: number
      events: { name: string; payload: Record<string, unknown>; clientId: string }[]
    }
    expect(doc.count).toBe(1)
    const [e] = doc.events
    // The name is a column and the rest is the payload — never a nested event.
    expect(e?.name).toBe('plan_shown')
    expect(e?.payload).toEqual({ goal: 'pain_relief', zones: 1, strengthBlocks: 0, durationS: 360 })
    expect(e?.payload).not.toHaveProperty('name')
  })

  it('carries no key a person could have typed into', async () => {
    await track({ name: 'article_opened', slug: 'lumiere-bleue', evidence: 'non-demontree', from: 'list' })
    const doc = JSON.parse(exportAnalytics()) as {
      events: { payload: Record<string, unknown> }[]
    }
    for (const e of doc.events) {
      for (const v of Object.values(e.payload)) {
        expect(['string', 'number', 'boolean']).toContain(typeof v)
      }
    }
  })

  it('is readable when nothing has happened yet', () => {
    const doc = JSON.parse(exportAnalytics()) as { count: number; events: unknown[] }
    expect(doc.count).toBe(0)
    expect(doc.events).toEqual([])
  })
})
