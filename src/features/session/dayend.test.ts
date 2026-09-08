import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import type { Settings } from '@/lib/types'
import { dayEndAt, hhmmOf, nextTimeOfDay, overrunKind, resolveEnd } from './dayend'

/** Tests run pinned to Europe/Paris (vite.config.ts), so local time is real. */
const at = (iso: string) => new Date(iso)
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch })

describe('nextTimeOfDay', () => {
  it('finds the time later the same day', () => {
    expect(nextTimeOfDay(at('2026-03-10T09:00:00'), '18:30')).toEqual(at('2026-03-10T18:30:00'))
  })

  it('rolls to tomorrow once the time has passed', () => {
    expect(nextTimeOfDay(at('2026-03-10T19:00:00'), '18:30')).toEqual(at('2026-03-11T18:30:00'))
  })

  it('is null without a time', () => {
    expect(nextTimeOfDay(at('2026-03-10T09:00:00'), null)).toBeNull()
  })
})

describe('dayEndAt', () => {
  it('closes at midnight when no quiet window is set', () => {
    expect(dayEndAt(at('2026-03-10T09:00:00'), settings())).toEqual(at('2026-03-11T00:00:00'))
  })

  it('closes at the start of the quiet window when it comes first', () => {
    const s = settings({ quietStart: '21:00', quietEnd: '07:00' })
    expect(dayEndAt(at('2026-03-10T09:00:00'), s)).toEqual(at('2026-03-10T21:00:00'))
  })

  it('never runs past midnight for a quiet window that starts after it', () => {
    // Quiet 00:30 -> 07:00: the first 00:30 after a 09:00 start is tomorrow,
    // which is later than the end of the day. The day still wins.
    const s = settings({ quietStart: '00:30', quietEnd: '07:00' })
    expect(dayEndAt(at('2026-03-10T09:00:00'), s)).toEqual(at('2026-03-11T00:00:00'))
  })

  it('a session started inside the quiet window still ends with its day', () => {
    const s = settings({ quietStart: '21:00', quietEnd: '07:00' })
    expect(dayEndAt(at('2026-03-10T22:30:00'), s)).toEqual(at('2026-03-11T00:00:00'))
  })

  it('a session started just before midnight ends at midnight', () => {
    expect(dayEndAt(at('2026-03-10T23:59:00'), settings())).toEqual(at('2026-03-11T00:00:00'))
  })
})

describe('overrunKind', () => {
  const s = settings({ quietStart: '21:00', quietEnd: '07:00' })

  it('leaves a session inside its day alone', () => {
    expect(overrunKind(at('2026-03-10T09:00:00'), s, at('2026-03-10T20:59:00'))).toBe('none')
  })

  it('closes at the boundary while still on the same day', () => {
    expect(overrunKind(at('2026-03-10T09:00:00'), s, at('2026-03-10T21:30:00'))).toBe('close')
  })

  it('asks once the session has survived into another day', () => {
    expect(overrunKind(at('2026-03-10T09:00:00'), s, at('2026-03-11T08:00:00'))).toBe('ask')
  })

  it('asks about a day forgotten over a whole weekend', () => {
    expect(overrunKind(at('2026-03-06T09:00:00'), s, at('2026-03-09T08:30:00'))).toBe('ask')
  })
})

describe('resolveEnd', () => {
  const started = at('2026-03-10T09:00:00')
  const latest = at('2026-03-11T00:00:00')

  it('reads the answer on the day the session started', () => {
    expect(resolveEnd('18:00', started, latest)).toEqual(at('2026-03-10T18:00:00'))
  })

  it('rolls past midnight when the answer falls before the start', () => {
    const lateStart = at('2026-03-10T22:00:00')
    const lateLatest = at('2026-03-11T02:00:00')
    expect(resolveEnd('01:00', lateStart, lateLatest)).toEqual(at('2026-03-11T01:00:00'))
  })

  it('never lands past the boundary the day would have closed at', () => {
    const lateStart = at('2026-03-10T22:00:00')
    expect(resolveEnd('01:00', lateStart, latest)).toEqual(latest)
  })

  it('reads an answer before the start as past midnight, then clamps it', () => {
    // 08:00 cannot mean the morning of a day that began at 09:00, so it is read
    // as the next one — and the boundary still caps it.
    expect(resolveEnd('08:00', started, latest)).toEqual(latest)
  })

  it('is null on an unparseable answer', () => {
    expect(resolveEnd('', started, latest)).toBeNull()
  })
})

describe('hhmmOf', () => {
  it('pads both halves', () => {
    expect(hhmmOf(at('2026-03-10T09:05:00'))).toBe('09:05')
    expect(hhmmOf(at('2026-03-10T21:00:00'))).toBe('21:00')
  })
})
