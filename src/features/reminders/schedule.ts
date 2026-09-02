import type { ReminderKind, Settings } from '@/lib/types'
import { isoWeekday, minutesOfDay, minutesOfDayFrom } from '@/lib/date'
import { stableId } from '@/lib/uuid'

/**
 * Pure planning logic (§8.2). No plugin, no clock of its own, no I/O — every
 * input is an argument, so the rules can be tested exhaustively.
 */

export interface Occurrence {
  /** Deterministic notification id: hash(sessionId, kind, index). Lets the app
      cancel a whole session without keeping a list around (§8.2). */
  id: number
  kind: ReminderKind
  at: Date
  index: number
}

/** 8 hours ahead, per the spec. */
export const HORIZON_MINUTES = 8 * 60

/** Fixed cadence for the optional eye reminder. See DECISIONS.md. */
export const EYE_INTERVAL_MIN = 20

/** An eye reminder this close to a stand reminder is dropped: the stand break
    already covers looking away (§8.1). */
const EYE_ABSORB_MIN = 5

export const SNOOZE_MINUTES = 10

export function occurrenceId(sessionId: string, kind: ReminderKind, index: number): number {
  return stableId(`${sessionId}|${kind}|${index}`)
}

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000)
}

/**
 * True when the local wall-clock time of `d` falls inside the quiet window.
 * The window may wrap past midnight (22:00 -> 07:00).
 */
export function inQuietWindow(d: Date, quietStart: string | null, quietEnd: string | null): boolean {
  const start = minutesOfDay(quietStart)
  const end = minutesOfDay(quietEnd)
  if (start === null || end === null || start === end) return false

  const now = minutesOfDayFrom(d)
  return start < end ? now >= start && now < end : now >= start || now < end
}

/** True when the local weekday of `d` is one the user marked active. */
export function onActiveDay(d: Date, weekdays: number[]): boolean {
  if (weekdays.length === 0) return true
  return weekdays.includes(isoWeekday(d))
}

function allowed(d: Date, settings: Settings): boolean {
  // Both checks read the wall clock of the occurrence itself, so a DST shift
  // between now and then is applied by the platform, not guessed here.
  return (
    onActiveDay(d, settings.weekdays) &&
    !inQuietWindow(d, settings.quietStart, settings.quietEnd)
  )
}

/** Local Date for "HH:MM" on the same calendar day as `ref`, offset by `dayOffset`. */
function atLocalTime(ref: Date, hhmm: string, dayOffset: number): Date | null {
  const mins = minutesOfDay(hhmm)
  if (mins === null) return null
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + dayOffset, 0, 0, 0, 0)
  d.setMinutes(mins)
  return d
}

export interface PlanInput {
  sessionId: string
  from: Date
  settings: Settings
  horizonMinutes?: number
}

/**
 * Every occurrence to schedule for a work session, sorted by time.
 * Occurrences that fall in a quiet window or on an inactive day are dropped,
 * not shifted: a reminder that arrives at a moment the user excluded is worse
 * than no reminder.
 */
export function planOccurrences({
  sessionId,
  from,
  settings,
  horizonMinutes = HORIZON_MINUTES,
}: PlanInput): Occurrence[] {
  const horizonEnd = addMinutes(from, horizonMinutes)
  const out: Occurrence[] = []

  // --- The one that matters: stand up every `intervalMin`.
  const interval = Math.max(1, settings.intervalMin)
  const standTimes: Date[] = []
  for (let i = 1; ; i++) {
    const at = addMinutes(from, interval * i)
    if (at > horizonEnd) break
    standTimes.push(at)
    // The index is the occurrence number, not the position after filtering, so
    // ids stay stable when settings change mid-session.
    if (allowed(at, settings)) {
      out.push({ id: occurrenceId(sessionId, 'stand', i), kind: 'stand', at, index: i })
    }
  }

  // --- Optional eye reminders, off by default (§8.1).
  if (settings.eyeReminders) {
    for (let i = 1; ; i++) {
      const at = addMinutes(from, EYE_INTERVAL_MIN * i)
      if (at > horizonEnd) break
      if (!allowed(at, settings)) continue
      const absorbed = standTimes.some(
        (s) => Math.abs(s.getTime() - at.getTime()) <= EYE_ABSORB_MIN * 60_000,
      )
      if (absorbed) continue
      out.push({ id: occurrenceId(sessionId, 'eyes', i), kind: 'eyes', at, index: i })
    }
  }

  // --- Fixed mobility slots. Two days are considered so a late session that
  //     runs past midnight still picks up the next day's slots.
  let mobilityIndex = 0
  for (const dayOffset of [0, 1]) {
    for (const hhmm of settings.mobilityTimes) {
      const at = atLocalTime(from, hhmm, dayOffset)
      if (!at) continue
      mobilityIndex++
      if (at <= from || at > horizonEnd) continue
      if (!allowed(at, settings)) continue
      out.push({
        id: occurrenceId(sessionId, 'mobility', mobilityIndex),
        kind: 'mobility',
        at,
        index: mobilityIndex,
      })
    }
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime())
  return out
}

/**
 * The single occurrence created by "+10 min". It deliberately does not shift
 * the grid (§8.4) — the next scheduled stand reminder still fires on time.
 * The index is derived from the minute it lands on, so two snoozes in the same
 * session never collide and a replayed snooze is idempotent.
 */
export function planSnooze(sessionId: string, from: Date): Occurrence {
  const at = addMinutes(from, SNOOZE_MINUTES)
  const index = Math.floor(at.getTime() / 60_000)
  return { id: occurrenceId(sessionId, 'stand', index), kind: 'stand', at, index }
}

/** Occurrences still in the future. */
export function pendingAfter(occurrences: Occurrence[], now: Date): Occurrence[] {
  return occurrences.filter((o) => o.at.getTime() > now.getTime())
}

/**
 * The next one to arm: only ever one reminder is scheduled at a time, so that
 * missing it stops the chain instead of letting the next fire on schedule.
 */
export function firstOccurrence(occurrences: Occurrence[]): Occurrence | null {
  if (occurrences.length === 0) return null
  return [...occurrences].sort((a, b) => a.at.getTime() - b.at.getTime())[0]
}

/**
 * The armed occurrence whose time has come and gone. With one reminder armed at
 * a time this is how the app finds out, on its next look at the clock, that a
 * notification fired while it was not running and was never answered.
 * The latest one wins, so a snooze taken on top of a reminder is what shows.
 */
export function dueBy(occurrences: Occurrence[], now: Date): Occurrence | null {
  const past = occurrences.filter((o) => o.at.getTime() <= now.getTime())
  if (past.length === 0) return null
  return past.sort((a, b) => b.at.getTime() - a.at.getTime())[0]
}
