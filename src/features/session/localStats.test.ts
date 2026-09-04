import { describe, expect, it } from 'vitest'
import type { Completion, ReminderAction, ReminderEvent } from '@/lib/types'
import { buildLocalStats } from './localStats'

const today = '2026-09-01' // mardi

function ev(localDate: string, action: ReminderAction, i = 0): ReminderEvent {
  return {
    clientId: `${localDate}-${action}-${i}`,
    sessionId: 's1',
    kind: 'stand',
    firedAt: `${localDate}T09:00:00.000Z`,
    action,
    actedAt: `${localDate}T09:01:00.000Z`,
    localDate,
  }
}

function done(localDate: string, n: number): ReminderEvent[] {
  return Array.from({ length: n }, (_, i) => ev(localDate, 'done', i))
}

function completion(localDate: string, durationS: number, i = 0): Completion {
  return {
    clientId: `${localDate}-c${i}`,
    routineId: null,
    routineSlug: 'debout',
    completedAt: `${localDate}T09:05:00.000Z`,
    durationS,
    localDate,
  }
}

const base = { today, span: 7, weekdays: [1, 2, 3, 4, 5] }

describe('buildLocalStats', () => {
  it('counts today from the journal alone', () => {
    const stats = buildLocalStats({
      ...base,
      events: [...done(today, 3), ev(today, 'expired', 9)],
      completions: [],
    })
    expect(stats.standsToday).toBe(3)
    expect(stats.remindersToday).toBe(4)
  })

  it('gives one bar per day of the range, oldest first', () => {
    const stats = buildLocalStats({ ...base, events: done(today, 3), completions: [] })
    expect(stats.standsByDay).toHaveLength(7)
    expect(stats.standsByDay[0]?.localDate).toBe('2026-08-26')
    expect(stats.standsByDay[6]).toEqual({ localDate: today, stands: 3, reminders: 3 })
  })

  it('sums only the minutes moved inside the range', () => {
    const stats = buildLocalStats({
      ...base,
      events: [],
      completions: [completion(today, 180), completion('2026-07-01', 600)],
    })
    expect(stats.minutesMoved).toBe(3)
  })

  it('reports the response rate, and null when nothing has fired', () => {
    const stats = buildLocalStats({
      ...base,
      events: [ev(today, 'done'), ev(today, 'snoozed', 1), ev(today, 'expired', 2)],
      completions: [],
    })
    expect(stats.adherence).toBeCloseTo(2 / 3)
    expect(buildLocalStats({ ...base, events: [], completions: [] }).adherence).toBeNull()
  })

  it('carries the streak across the weekend, like the server', () => {
    const stats = buildLocalStats({
      ...base,
      events: [
        ...done('2026-08-28', 3), // vendredi
        ...done('2026-08-31', 3), // lundi
        ...done(today, 3), // mardi
      ],
      completions: [],
    })
    expect(stats.streak).toBe(3)
  })

  it('is all zeroes, never null, on an empty journal', () => {
    const stats = buildLocalStats({ ...base, events: [], completions: [] })
    expect(stats.standsToday).toBe(0)
    expect(stats.streak).toBe(0)
    expect(stats.minutesMoved).toBe(0)
    expect(stats.standsByDay).toHaveLength(7)
  })
})
