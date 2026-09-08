import { beforeEach, describe, expect, it, vi } from 'vitest'

// The real module reaches for @capacitor/preferences, which needs a webview.
vi.mock('@/lib/storage', () => {
  const store = new Map<string, string>()
  return {
    KEYS: { stepDurations: 'player.durations' },
    getJSON: <T>(k: string, fallback: T) => {
      const raw = store.get(k)
      return Promise.resolve(raw === undefined ? fallback : (JSON.parse(raw) as T))
    },
    setJSON: (k: string, v: unknown) => {
      store.set(k, JSON.stringify(v))
      return Promise.resolve()
    },
  }
})

import {
  MAX_DURATION_S,
  MIN_DURATION_S,
  clampDuration,
  durationFor,
  isCustomised,
  loadDurations,
  resetRoutine,
  setDuration,
  totalFor,
} from './durations'

const steps = [
  { position: 1, durationS: 30 },
  { position: 2, durationS: 30 },
  { position: 3, durationS: 60 },
]

beforeEach(async () => {
  await resetRoutine('debout')
  await resetRoutine('yeux')
  await loadDurations()
})

describe('clampDuration', () => {
  it('snaps to the stepper increment', () => {
    expect(clampDuration(34)).toBe(30)
    expect(clampDuration(36)).toBe(40)
  })

  it('refuses to leave the bounds', () => {
    expect(clampDuration(0)).toBe(MIN_DURATION_S)
    expect(clampDuration(-90)).toBe(MIN_DURATION_S)
    expect(clampDuration(9999)).toBe(MAX_DURATION_S)
  })
})

describe('overrides', () => {
  it('falls back to the content until something is set', () => {
    expect(durationFor('debout', 1, 30)).toBe(30)
    expect(isCustomised('debout')).toBe(false)
    expect(totalFor('debout', steps)).toBe(120)
  })

  it('applies to one step only', async () => {
    await setDuration('debout', 2, 60)
    expect(durationFor('debout', 1, 30)).toBe(30)
    expect(durationFor('debout', 2, 30)).toBe(60)
    expect(totalFor('debout', steps)).toBe(150)
    expect(isCustomised('debout')).toBe(true)
  })

  it('does not leak between routines', async () => {
    await setDuration('debout', 1, 90)
    expect(durationFor('yeux', 1, 20)).toBe(20)
    expect(isCustomised('yeux')).toBe(false)
  })

  it('clamps what is stored, not only what is displayed', async () => {
    await setDuration('debout', 1, 9999)
    expect(durationFor('debout', 1, 30)).toBe(MAX_DURATION_S)
  })

  it('comes back after a reload', async () => {
    await setDuration('debout', 3, 120)
    await loadDurations()
    expect(durationFor('debout', 3, 60)).toBe(120)
  })

  it('resets a whole routine at once', async () => {
    await setDuration('debout', 1, 90)
    await setDuration('debout', 2, 90)
    await resetRoutine('debout')
    expect(isCustomised('debout')).toBe(false)
    expect(totalFor('debout', steps)).toBe(120)
  })
})
