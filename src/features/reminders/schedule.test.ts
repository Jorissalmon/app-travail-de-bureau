import { describe, expect, it } from 'vitest'
import type { Settings } from '@/lib/types'
import {
  EYE_INTERVAL_MIN,
  HORIZON_MINUTES,
  SNOOZE_MINUTES,
  allowedAt,
  dueBy,
  firstOccurrence,
  inQuietWindow,
  occurrenceId,
  onActiveDay,
  planNext,
  planOccurrences,
  planResume,
  planSnooze,
  nextAutoStart,
} from './schedule'

const base: Settings = {
  intervalMin: 30,
  breakMinutes: 3,
  eyeReminders: false,
  mobilityTimes: [],
  quietStart: null,
  quietEnd: null,
  weekdays: [1, 2, 3, 4, 5],
  autoStartAt: null,
  sound: false,
  vibrate: true,
}

/** Wednesday 2026-09-02, 09:00 local. */
const wed9 = () => new Date(2026, 8, 2, 9, 0, 0, 0)

describe('planOccurrences — stand reminders', () => {
  it('lays 30-minute occurrences across the 8-hour horizon', () => {
    const plan = planOccurrences({ sessionId: 's1', from: wed9(), settings: base })
    const stands = plan.filter((o) => o.kind === 'stand')

    expect(stands).toHaveLength(HORIZON_MINUTES / 30)
    expect(stands[0]!.at).toEqual(new Date(2026, 8, 2, 9, 30))
    expect(stands.at(-1)!.at).toEqual(new Date(2026, 8, 2, 17, 0))
  })

  it('honours a custom interval', () => {
    const plan = planOccurrences({
      sessionId: 's1',
      from: wed9(),
      settings: { ...base, intervalMin: 45 },
    })
    expect(plan.filter((o) => o.kind === 'stand')).toHaveLength(10)
  })

  it('never schedules anything at or before the start time', () => {
    const from = wed9()
    const plan = planOccurrences({ sessionId: 's1', from, settings: base })
    expect(plan.every((o) => o.at.getTime() > from.getTime())).toBe(true)
  })

  it('is sorted by time', () => {
    const plan = planOccurrences({
      sessionId: 's1',
      from: wed9(),
      settings: { ...base, eyeReminders: true, mobilityTimes: ['10:30', '15:30'] },
    })
    const times = plan.map((o) => o.at.getTime())
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })
})

describe('planOccurrences — quiet window', () => {
  it('drops occurrences inside a same-day window', () => {
    const plan = planOccurrences({
      sessionId: 's1',
      from: wed9(),
      settings: { ...base, quietStart: '12:00', quietEnd: '14:00' },
    })
    const inWindow = plan.filter((o) => o.at.getHours() === 12 || o.at.getHours() === 13)
    expect(inWindow).toHaveLength(0)
    // 14:00 is the exclusive end, so it is kept.
    expect(plan.some((o) => o.at.getHours() === 14 && o.at.getMinutes() === 0)).toBe(true)
  })

  it('drops occurrences inside a window that wraps past midnight', () => {
    // Session started at 21:00, quiet 22:00 -> 07:00.
    const plan = planOccurrences({
      sessionId: 's1',
      from: new Date(2026, 8, 2, 21, 0),
      settings: { ...base, quietStart: '22:00', quietEnd: '07:00', weekdays: [] },
    })
    expect(plan.every((o) => o.at.getHours() < 22 && o.at.getHours() >= 7)).toBe(true)
  })

  it('treats an empty or degenerate window as no window', () => {
    const d = new Date(2026, 8, 2, 23, 0)
    expect(inQuietWindow(d, null, '07:00')).toBe(false)
    expect(inQuietWindow(d, '22:00', null)).toBe(false)
    expect(inQuietWindow(d, '22:00', '22:00')).toBe(false)
  })
})

describe('planOccurrences — active days', () => {
  it('drops occurrences that roll into an inactive day', () => {
    // Friday 22:00, weekdays Mon-Fri: everything past midnight is Saturday.
    const plan = planOccurrences({
      sessionId: 's1',
      from: new Date(2026, 8, 4, 22, 0),
      settings: base,
    })
    expect(plan.every((o) => o.at.getDate() === 4)).toBe(true)
  })

  it('treats an empty weekday list as every day', () => {
    const sunday = new Date(2026, 8, 6, 9, 0)
    expect(onActiveDay(sunday, [])).toBe(true)
    const plan = planOccurrences({
      sessionId: 's1',
      from: sunday,
      settings: { ...base, weekdays: [] },
    })
    expect(plan.length).toBeGreaterThan(0)
  })

  it('drops everything when the start day itself is inactive', () => {
    const sunday = new Date(2026, 8, 6, 9, 0)
    const plan = planOccurrences({ sessionId: 's1', from: sunday, settings: base })
    expect(plan).toHaveLength(0)
  })
})

describe('planOccurrences — eye reminders', () => {
  it('adds nothing when disabled', () => {
    const plan = planOccurrences({ sessionId: 's1', from: wed9(), settings: base })
    expect(plan.some((o) => o.kind === 'eyes')).toBe(false)
  })

  it('fires every 20 minutes but is absorbed by a nearby stand reminder', () => {
    const plan = planOccurrences({
      sessionId: 's1',
      from: wed9(),
      settings: { ...base, eyeReminders: true },
    })
    const eyes = plan.filter((o) => o.kind === 'eyes')
    // 20, 40, 80, 100, 140... — the 60/120/180 marks collide with the 30-minute
    // grid and are dropped.
    expect(eyes.some((o) => o.at.getTime() === wed9().getTime() + 20 * 60_000)).toBe(true)
    expect(eyes.some((o) => o.at.getTime() === wed9().getTime() + 60 * 60_000)).toBe(false)
    expect(eyes.every((o) => o.index * EYE_INTERVAL_MIN <= HORIZON_MINUTES)).toBe(true)
  })
})

describe('planOccurrences — mobility slots', () => {
  it('schedules the configured wall-clock times inside the horizon', () => {
    const plan = planOccurrences({
      sessionId: 's1',
      from: wed9(),
      settings: { ...base, mobilityTimes: ['10:30', '15:30'] },
    })
    const mob = plan.filter((o) => o.kind === 'mobility')
    expect(mob.map((o) => `${o.at.getHours()}:${o.at.getMinutes()}`)).toEqual(['10:30', '15:30'])
  })

  it('ignores a slot already past', () => {
    const plan = planOccurrences({
      sessionId: 's1',
      from: new Date(2026, 8, 2, 16, 0),
      settings: { ...base, mobilityTimes: ['10:30', '15:30'] },
    })
    expect(plan.filter((o) => o.kind === 'mobility')).toHaveLength(0)
  })
})

describe('planOccurrences — daylight saving', () => {
  // Tests run with TZ=Europe/Paris (see vite.config.ts); the clock springs
  // forward 2026-03-29 at 02:00 -> 03:00.
  it('runs in a timezone that actually observes DST', () => {
    const winter = new Date(2026, 0, 15).getTimezoneOffset()
    const summer = new Date(2026, 6, 15).getTimezoneOffset()
    expect(winter).not.toBe(summer)
  })

  it('skips the hour the clock jumps over', () => {
    const from = new Date(2026, 2, 29, 1, 0)
    const plan = planOccurrences({
      sessionId: 's1',
      from,
      settings: { ...base, weekdays: [] },
    })
    const hours = plan.filter((o) => o.kind === 'stand').map((o) => o.at.getHours())
    // 01:30, then straight to 03:00 — 02:00 does not exist that night.
    expect(hours.slice(0, 3)).toEqual([1, 3, 3])
  })

  it('keeps the interval in real minutes across a spring-forward night', () => {
    const from = new Date(2026, 2, 28, 23, 0)
    const plan = planOccurrences({
      sessionId: 's1',
      from,
      settings: { ...base, weekdays: [] },
    })
    const stands = plan.filter((o) => o.kind === 'stand')
    for (let i = 0; i < stands.length; i++) {
      expect(stands[i]!.at.getTime() - from.getTime()).toBe((i + 1) * 30 * 60_000)
    }
  })

  it('applies the quiet window to the local wall clock, not to elapsed time', () => {
    const from = new Date(2026, 2, 28, 23, 0)
    const plan = planOccurrences({
      sessionId: 's1',
      from,
      settings: { ...base, weekdays: [], quietStart: '01:00', quietEnd: '06:00' },
    })
    expect(plan.every((o) => !(o.at.getHours() >= 1 && o.at.getHours() < 6))).toBe(true)
  })
})

describe('occurrence ids', () => {
  it('are deterministic and fit in a 31-bit positive integer', () => {
    const a = occurrenceId('session-a', 'stand', 3)
    expect(occurrenceId('session-a', 'stand', 3)).toBe(a)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(0x7fffffff)
    expect(Number.isInteger(a)).toBe(true)
  })

  it('differ across sessions, kinds and indexes', () => {
    const ids = new Set([
      occurrenceId('a', 'stand', 1),
      occurrenceId('b', 'stand', 1),
      occurrenceId('a', 'eyes', 1),
      occurrenceId('a', 'stand', 2),
    ])
    expect(ids.size).toBe(4)
  })

  it('are unique across a whole plan', () => {
    const plan = planOccurrences({
      sessionId: 's1',
      from: wed9(),
      settings: { ...base, eyeReminders: true, mobilityTimes: ['10:30', '15:30'] },
    })
    expect(new Set(plan.map((o) => o.id)).size).toBe(plan.length)
  })
})

describe('planSnooze', () => {
  it('lands 10 minutes later and does not move the grid', () => {
    const now = new Date(2026, 8, 2, 9, 32)
    const s = planSnooze('s1', now)
    expect(s.at.getTime() - now.getTime()).toBe(SNOOZE_MINUTES * 60_000)
    expect(s.kind).toBe('stand')

    const grid = planOccurrences({ sessionId: 's1', from: wed9(), settings: base })
    expect(grid.some((o) => o.id === s.id)).toBe(false)
  })

  it('is idempotent for the same target minute', () => {
    const now = new Date(2026, 8, 2, 9, 32, 10)
    const later = new Date(2026, 8, 2, 9, 32, 50)
    expect(planSnooze('s1', now).id).toBe(planSnooze('s1', later).id)
  })
})

describe('firstOccurrence / dueBy', () => {
  const at = (min: number) => ({
    id: min,
    kind: 'stand' as const,
    at: new Date(2026, 0, 5, 10, min, 0),
    index: min,
  })
  const now = new Date(2026, 0, 5, 10, 30, 0)

  it('arms the earliest of the plan, not the first written', () => {
    expect(firstOccurrence([at(50), at(40), at(45)])?.at.getMinutes()).toBe(40)
  })

  it('arms nothing out of an empty plan', () => {
    expect(firstOccurrence([])).toBeNull()
  })

  it('finds the reminder that came due while the app was away', () => {
    expect(dueBy([at(20), at(40)], now)?.at.getMinutes()).toBe(20)
  })

  it('reports the latest of several missed, so a snooze wins over what it followed', () => {
    expect(dueBy([at(10), at(20), at(40)], now)?.at.getMinutes()).toBe(20)
  })

  it('counts a reminder due this very second as fired', () => {
    expect(dueBy([at(30)], now)?.at.getMinutes()).toBe(30)
  })

  it('reports nothing when every armed reminder is still ahead', () => {
    expect(dueBy([at(40), at(50)], now)).toBeNull()
  })
})

describe('planResume', () => {
  it('lands exactly where the pause put it, keeping the kind', () => {
    const at = new Date(2026, 0, 5, 14, 12, 0)
    const occ = planResume('s1', 'eyes', at)
    expect(occ.kind).toBe('eyes')
    expect(occ.at.getTime()).toBe(at.getTime())
  })

  it('gives the same id for the same minute, so a replayed resume is idempotent', () => {
    const at = new Date(2026, 0, 5, 14, 12, 0)
    expect(planResume('s1', 'stand', at).id).toBe(planResume('s1', 'stand', at).id)
  })

  it('separates two resumes a minute apart', () => {
    const a = planResume('s1', 'stand', new Date(2026, 0, 5, 14, 12, 0))
    const b = planResume('s1', 'stand', new Date(2026, 0, 5, 14, 13, 0))
    expect(a.id).not.toBe(b.id)
  })

  it('separates the kinds, so eyes and stand cannot cancel each other', () => {
    const at = new Date(2026, 0, 5, 14, 12, 0)
    expect(planResume('s1', 'eyes', at).id).not.toBe(planResume('s1', 'stand', at).id)
  })
})

describe('allowedAt', () => {
  const quiet: Settings = { ...base, quietStart: '12:00', quietEnd: '13:00' }

  it('refuses an instant inside the quiet window', () => {
    expect(allowedAt(new Date(2026, 0, 5, 12, 30), quiet)).toBe(false)
  })

  it('accepts an instant outside it', () => {
    expect(allowedAt(new Date(2026, 0, 5, 14, 30), quiet)).toBe(true)
  })

  it('refuses a day the user excluded', () => {
    // 2026-01-10 is a Saturday; the default weekdays are Monday to Friday.
    expect(allowedAt(new Date(2026, 0, 10, 10, 0), base)).toBe(false)
  })
})

describe('planNext — chaque cadence garde son propre ancrage', () => {
  const withEyes: Settings = { ...base, eyeReminders: true, mobilityTimes: [] }
  const t = (h: number, m: number) => new Date(2026, 0, 5, h, m, 0) // un lundi

  it('arms the eye reminder first when both start together', () => {
    const start = t(9, 0)
    const next = planNext('s', { stand: start, eyes: start }, withEyes, start)
    expect(next?.kind).toBe('eyes')
    expect(next?.at.getMinutes()).toBe(20)
  })

  it('lets the stand reminder through once the eyes have had their turn', () => {
    // 9 h 20 : les yeux viennent de répondre, donc leur ancrage bouge. Le
    // debout, lui, reste dû à 9 h 30 comme depuis le début.
    const next = planNext('s', { stand: t(9, 0), eyes: t(9, 20) }, withEyes, t(9, 20))
    expect(next?.kind).toBe('stand')
    expect(next?.at.getHours()).toBe(9)
    expect(next?.at.getMinutes()).toBe(30)
  })

  it('never lets the shorter cadence starve the longer one over a morning', () => {
    // On simule la matinée : à chaque réponse, seul l ancrage du type répondu bouge.
    const anchors = { stand: t(9, 0), eyes: t(9, 0) }
    const fired: string[] = []
    let now = t(9, 0)
    for (let i = 0; i < 8; i++) {
      const next = planNext('s', anchors, withEyes, now)
      if (!next) break
      fired.push(next.kind)
      now = next.at
      if (next.kind === 'stand') anchors.stand = next.at
      if (next.kind === 'eyes') anchors.eyes = next.at
    }
    expect(fired).toContain('stand')
    expect(fired.filter((k) => k === 'stand').length).toBeGreaterThan(1)
  })

  it('drops an eye reminder that lands on top of a stand break', () => {
    // Ancrages tels que les deux tombent à deux minutes d intervalle.
    const next = planNext('s', { stand: t(9, 0), eyes: t(9, 12) }, withEyes, t(9, 25))
    expect(next?.kind).toBe('stand')
  })

  it('plans only the stand reminder when the eyes are switched off', () => {
    const start = t(9, 0)
    const next = planNext('s', { stand: start, eyes: start }, { ...base, mobilityTimes: [] }, start)
    expect(next?.kind).toBe('stand')
  })

  it('arms nothing inside a quiet window', () => {
    const quiet: Settings = { ...base, mobilityTimes: [], quietStart: '09:00', quietEnd: '18:00' }
    expect(planNext('s', { stand: t(9, 0), eyes: t(9, 0) }, quiet, t(9, 0))).toBeNull()
  })

  it('picks a mobility slot when it comes before the next stand break', () => {
    const withMobility: Settings = { ...base, mobilityTimes: ['09:10'] }
    const next = planNext('s', { stand: t(9, 0), eyes: t(9, 0) }, withMobility, t(9, 0))
    expect(next?.kind).toBe('mobility')
  })
})

describe('nextAutoStart', () => {
  // 2026-03-10 is a Tuesday, 2026-03-14 a Saturday.
  const weekdays = [1, 2, 3, 4, 5]

  it('is null when no time is set — that is how it stays off', () => {
    expect(nextAutoStart(null, weekdays, new Date('2026-03-10T07:00:00'))).toBeNull()
  })

  it('picks today when the hour is still ahead', () => {
    expect(nextAutoStart('09:00', weekdays, new Date('2026-03-10T07:00:00'))).toEqual(
      new Date('2026-03-10T09:00:00'),
    )
  })

  it('rolls to tomorrow once the hour has passed', () => {
    expect(nextAutoStart('09:00', weekdays, new Date('2026-03-10T09:00:00'))).toEqual(
      new Date('2026-03-11T09:00:00'),
    )
  })

  it('skips the days the user excluded', () => {
    // Friday evening: the next active day is Monday, not Saturday.
    expect(nextAutoStart('09:00', weekdays, new Date('2026-03-13T18:00:00'))).toEqual(
      new Date('2026-03-16T09:00:00'),
    )
  })

  it('treats an empty weekday list as every day, like the reminder planner', () => {
    expect(nextAutoStart('09:00', [], new Date('2026-03-13T18:00:00'))).toEqual(
      new Date('2026-03-14T09:00:00'),
    )
  })

  it('is null when no selected day exists', () => {
    expect(nextAutoStart('09:00', [], new Date('2026-03-10T07:00:00'))).not.toBeNull()
    expect(nextAutoStart('09:00', [8], new Date('2026-03-10T07:00:00'))).toBeNull()
  })
})
