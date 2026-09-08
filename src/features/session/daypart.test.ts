import { describe, expect, it } from 'vitest'
import { adviceFor, bandFor } from './daypart'
import { LOCAL_ROUTINES } from '@/content'

/** Tests run pinned to Europe/Paris (see vite.config.ts). */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2026, 8, 2, h!, m!, 0, 0)
}

const ALL = LOCAL_ROUTINES.map((r) => r.slug)

const ctx = (
  now: Date,
  over: Partial<{ sessionActive: boolean; standsToday: number; available: string[] }> = {},
) => ({
  now,
  sessionActive: true,
  standsToday: 0,
  available: ALL,
  ...over,
})

describe('bandFor', () => {
  it('walks the day in order', () => {
    expect(bandFor(at('02:00')).part).toBe('nuit')
    expect(bandFor(at('07:30')).part).toBe('matin')
    expect(bandFor(at('10:00')).part).toBe('matinee')
    expect(bandFor(at('12:15')).part).toBe('midi')
    expect(bandFor(at('15:00')).part).toBe('apres-midi')
    expect(bandFor(at('17:00')).part).toBe('fin-journee')
    expect(bandFor(at('20:00')).part).toBe('soir')
  })

  it('takes the band on its exact boundary', () => {
    expect(bandFor(at('09:00')).part).toBe('matinee')
    expect(bandFor(at('11:30')).part).toBe('midi')
    expect(bandFor(at('16:30')).part).toBe('fin-journee')
  })

  it('wraps back to night after midnight', () => {
    expect(bandFor(at('00:01')).part).toBe('nuit')
    expect(bandFor(at('04:59')).part).toBe('nuit')
  })
})

describe('adviceFor', () => {
  it('only ever suggests a routine that exists', () => {
    const slugs = new Set(LOCAL_ROUTINES.map((r) => r.slug))
    for (let h = 0; h < 24; h++) {
      for (let stands = 0; stands < 8; stands++) {
        const advice = adviceFor(ctx(at(`${String(h).padStart(2, '0')}:15`), { standsToday: stands }))
        expect(advice, `${h}h, ${stands} levers`).not.toBeNull()
        expect(slugs, `${h}h, ${stands} levers`).toContain(advice!.routineSlug)
      }
    }
  })

  it('varies as the day accumulates, instead of repeating one routine', () => {
    const afternoon = at('15:00')
    const suggested = new Set(
      [0, 1, 2, 3].map((n) => adviceFor(ctx(afternoon, { standsToday: n }))!.routineSlug),
    )
    expect(suggested.size).toBeGreaterThan(1)
  })

  it('says the session is off rather than giving a reason to move', () => {
    const advice = adviceFor(ctx(at('10:00'), { sessionActive: false }))
    expect(advice!.why).toContain('session')
  })

  it('falls back when the database has none of the band’s routines', () => {
    // What actually happened: the code named routines the database did not yet
    // hold, and the home card silently rendered nothing.
    const advice = adviceFor(ctx(at('15:00'), { available: ['debout'] }))
    expect(advice?.routineSlug).toBe('debout')
  })

  it('gives up only when there is no content at all', () => {
    expect(adviceFor(ctx(at('15:00'), { available: [] }))).toBeNull()
  })

  it('is stable for the same inputs', () => {
    const a = adviceFor(ctx(at('15:00'), { standsToday: 2 }))
    const b = adviceFor(ctx(at('15:00'), { standsToday: 2 }))
    expect(a).toEqual(b)
  })
})
