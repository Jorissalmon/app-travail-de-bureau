import { describe, expect, it } from 'vitest'
import { buildJournal, type JournalInput } from './journal'
import type { Completion, ReminderEvent } from '@/lib/types'

const NOW = '2026-09-08T18:00:00.000Z'
const TODAY = '2026-09-08'

function event(p: Partial<ReminderEvent>): ReminderEvent {
  return {
    clientId: Math.random().toString(36).slice(2),
    sessionId: null,
    kind: 'stand',
    firedAt: `${TODAY}T10:00:00.000Z`,
    action: 'done',
    actedAt: `${TODAY}T10:01:00.000Z`,
    localDate: TODAY,
    ...p,
  }
}

function completion(p: Partial<Completion>): Completion {
  return {
    clientId: Math.random().toString(36).slice(2),
    routineId: null,
    routineSlug: 'debout',
    completedAt: `${TODAY}T10:01:00.000Z`,
    durationS: 180,
    localDate: TODAY,
    ...p,
  }
}

function build(p: Partial<JournalInput> = {}) {
  return buildJournal({
    sessions: [],
    events: [],
    completions: [],
    today: TODAY,
    span: 7,
    now: NOW,
    ...p,
  })
}

describe('buildJournal', () => {
  it('gives nothing back when nothing happened', () => {
    expect(build()).toEqual([])
  })

  it('counts a closed day from its own two ends', () => {
    const [d] = build({
      sessions: [
        { startedAt: `${TODAY}T07:00:00.000Z`, endedAt: `${TODAY}T15:00:00.000Z`, localDate: TODAY },
      ],
    })
    expect(d!.workedS).toBe(8 * 3600)
    expect(d!.open).toBe(false)
    expect(d!.entries.map((e) => e.kind)).toEqual(['start', 'end'])
  })

  // A day still running has no end to measure against; `now` is the honest one.
  it('counts a day still running up to now, and says so', () => {
    const [d] = build({
      sessions: [{ startedAt: `${TODAY}T16:00:00.000Z`, endedAt: null, localDate: TODAY }],
    })
    expect(d!.workedS).toBe(2 * 3600)
    expect(d!.open).toBe(true)
    expect(d!.entries.map((e) => e.kind)).toEqual(['start'])
  })

  it('takes the time moved out of the time worked to get the focus time', () => {
    const [d] = build({
      sessions: [
        { startedAt: `${TODAY}T08:00:00.000Z`, endedAt: `${TODAY}T09:00:00.000Z`, localDate: TODAY },
      ],
      completions: [completion({ durationS: 300, completedAt: `${TODAY}T08:30:00.000Z` })],
    })
    expect(d!.workedS).toBe(3600)
    expect(d!.movedS).toBe(300)
    expect(d!.focusS).toBe(3300)
  })

  it('never reports a negative focus time', () => {
    const [d] = build({
      completions: [completion({ durationS: 600 })],
    })
    expect(d!.focusS).toBe(0)
  })

  it('writes a line for a reported reminder and one for a missed one', () => {
    const [d] = build({
      events: [
        event({ action: 'snoozed', firedAt: `${TODAY}T11:00:00.000Z`, actedAt: `${TODAY}T11:00:30.000Z` }),
        event({ action: 'expired', firedAt: `${TODAY}T12:00:00.000Z`, actedAt: null }),
      ],
    })
    expect(d!.entries.map((e) => e.kind)).toEqual(['snoozed', 'missed'])
    expect(d!.reminders).toBe(2)
    expect(d!.stands).toBe(0)
  })

  // The « Fait » of the notification and the routine that follows it are one
  // break, not two — the day would otherwise read twice as busy as it was.
  it('does not write both a lever and the routine it led to', () => {
    const [d] = build({
      events: [event({ action: 'done', actedAt: `${TODAY}T10:00:00.000Z` })],
      completions: [completion({ completedAt: `${TODAY}T10:03:00.000Z` })],
    })
    expect(d!.entries.map((e) => e.kind)).toEqual(['moved'])
    expect(d!.stands).toBe(1)
  })

  it('keeps a lever answered far from any routine', () => {
    const [d] = build({
      events: [event({ action: 'done', actedAt: `${TODAY}T10:00:00.000Z` })],
      completions: [completion({ completedAt: `${TODAY}T14:00:00.000Z` })],
    })
    expect(d!.entries.map((e) => e.kind)).toEqual(['stood', 'moved'])
  })

  it('sorts each day by the clock and the days newest first', () => {
    const before = '2026-09-07'
    const days = build({
      sessions: [
        { startedAt: `${before}T08:00:00.000Z`, endedAt: `${before}T16:00:00.000Z`, localDate: before },
        { startedAt: `${TODAY}T08:00:00.000Z`, endedAt: null, localDate: TODAY },
      ],
      events: [event({ action: 'snoozed', firedAt: `${TODAY}T09:00:00.000Z`, actedAt: `${TODAY}T09:00:00.000Z` })],
    })
    expect(days.map((d) => d.localDate)).toEqual([TODAY, before])
    expect(days[0]!.entries.map((e) => e.at)).toEqual([
      `${TODAY}T08:00:00.000Z`,
      `${TODAY}T09:00:00.000Z`,
    ])
  })

  it('drops what falls outside the range asked for', () => {
    const days = build({
      span: 7,
      sessions: [
        { startedAt: '2026-08-01T08:00:00.000Z', endedAt: '2026-08-01T16:00:00.000Z', localDate: '2026-08-01' },
        { startedAt: `${TODAY}T08:00:00.000Z`, endedAt: null, localDate: TODAY },
      ],
    })
    expect(days.map((d) => d.localDate)).toEqual([TODAY])
  })
})
