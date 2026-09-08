import { describe, expect, it } from 'vitest'
import { bandFor } from './daypart'

/**
 * Tests run pinned to Europe/Paris (see vite.config.ts).
 *
 * `adviceFor` and its tests are gone with the home screen's hourly advice card:
 * the adaptive plan is the single answer to « quoi faire maintenant », and a
 * second, tested function proposing a fixed routine by the hour was the old
 * product model still running beside the new one. `bandFor` and `nudgeFor`
 * survive because the stand reminder still speaks to the hour it fires at.
 */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2026, 8, 2, h!, m!, 0, 0)
}

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
