import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Same in-memory stand-in as the analytics test: node has no Preferences. */
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

/** Offline: the flush must be a silent no-op, never a thrown rejection. */
vi.mock('@/lib/api', () => ({
  api: {
    post: async () => {
      throw new Error('offline')
    },
    get: async () => {
      throw new Error('offline')
    },
  },
  isOffline: () => true,
}))

const { clearPain, flushPain, loadPain, painEntries, pullPain, recordPain } = await import('./pain')

/**
 * The pain journal is the only outcome the app reports, so what is pinned here
 * is that an answer given is an answer kept: bounded to 0-10, carrying its own
 * id, and never lost because the network was not there.
 */

beforeEach(async () => {
  await clearPain()
  await loadPain()
})

describe('recordPain', () => {
  it('keeps the answer, with an id of its own', async () => {
    const e = await recordPain({ zone: 'nuque', score: 7, source: 'post-session' })
    expect(e.clientId).toBeTruthy()
    expect(painEntries()).toHaveLength(1)
    expect(painEntries()[0]?.score).toBe(7)
  })

  it('gives distinct ids, so two answers cannot collapse into one', async () => {
    await recordPain({ zone: 'nuque', score: 7, source: 'post-session' })
    await recordPain({ zone: 'nuque', score: 5, source: 'post-session' })
    const ids = painEntries().map((e) => e.clientId)
    expect(new Set(ids).size).toBe(2)
  })

  it('clamps to the scale it showed, and never stores a fraction', async () => {
    expect((await recordPain({ zone: 'dos', score: 42, source: 'manual' })).score).toBe(10)
    expect((await recordPain({ zone: 'dos', score: -4, source: 'manual' })).score).toBe(0)
    expect((await recordPain({ zone: 'dos', score: 6.4, source: 'manual' })).score).toBe(6)
  })

  it('drops the routine slug rather than storing an empty one', async () => {
    const e = await recordPain({ zone: 'dos', score: 3, source: 'post-session' })
    expect(e).not.toHaveProperty('routineSlug')
  })

  it('records the date the answer belongs to, not the one it syncs on', async () => {
    const at = new Date('2026-03-16T21:30:00')
    const e = await recordPain({ zone: 'nuque', score: 4, source: 'manual', at })
    expect(e.localDate).toBe('2026-03-16')
  })
})

describe('offline', () => {
  it('keeps the answer when the flush cannot reach anything', async () => {
    await recordPain({ zone: 'nuque', score: 8, source: 'onboarding' })
    await expect(flushPain()).resolves.toBeUndefined()
    // The journal is the record; only the queue is drained by a success.
    expect(painEntries()).toHaveLength(1)
  })

  it('leaves the local journal alone when the pull fails', async () => {
    await recordPain({ zone: 'nuque', score: 8, source: 'onboarding' })
    await pullPain()
    expect(painEntries()).toHaveLength(1)
  })
})
