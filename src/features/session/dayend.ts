import type { Settings } from '@/lib/types'
import { localDate, minutesOfDay } from '@/lib/date'

/**
 * When the day is over, whether or not anyone pressed « Terminer ».
 *
 * Nothing used to end a session but the button and the notification action, so
 * a day forgotten on a Friday evening ran all weekend. That is not a cosmetic
 * problem: the longest sitting shown on the tracking screen would read fourteen
 * hours, because from the app's point of view that is literally what happened,
 * and the streak and the response rate go with it.
 *
 * Pure, like the reminder planner: every input is an argument, so the rule can
 * be tested at the boundaries that matter — midnight, a quiet window that wraps,
 * a session started inside one.
 */

/** Local midnight after `d`: the end of the calendar day `d` falls on. */
function nextMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0)
}

/** The first instant the wall clock reads `hhmm`, strictly after `d`. */
export function nextTimeOfDay(d: Date, hhmm: string | null): Date | null {
  const mins = minutesOfDay(hhmm)
  if (mins === null) return null
  for (const dayOffset of [0, 1]) {
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, 0, 0, 0, 0)
    at.setMinutes(mins)
    if (at.getTime() > d.getTime()) return at
  }
  return null
}

/**
 * The instant a session that began at `startedAt` stops counting.
 *
 * Two bounds, whichever comes first: the start of the quiet window — the hour
 * the user themself said no reminder may land — and the end of the active day.
 * Neither is a guess about when the person left their desk; both are a line
 * they drew. A session with no quiet window set still cannot outlive its day.
 */
export function dayEndAt(startedAt: Date, settings: Settings): Date {
  const midnight = nextMidnight(startedAt)
  const quiet = nextTimeOfDay(startedAt, settings.quietStart)
  return quiet && quiet.getTime() < midnight.getTime() ? quiet : midnight
}

/**
 * What to do about a session still open at `now`.
 *
 *  - `none`  — it is still within its day.
 *  - `close` — the boundary has passed and we are still on the day it belongs
 *    to, so closing it there states the user's own rule back to them.
 *  - `ask`   — it survived into another day. The boundary is the best guess
 *    available, and a guess is exactly what the numbers must not be built on,
 *    so the app asks instead of writing one down.
 */
export type Overrun = 'none' | 'close' | 'ask'

export function overrunKind(startedAt: Date, settings: Settings, now: Date): Overrun {
  const end = dayEndAt(startedAt, settings)
  if (now.getTime() < end.getTime()) return 'none'
  return localDate(now) === localDate(startedAt) ? 'close' : 'ask'
}

/**
 * The instant meant by an "HH:MM" answer to « tu as fini vers quelle heure ? ».
 *
 * Read on the day the session started, or the day after when the answer falls
 * before the start — someone who began at 22:00 and answers 01:00 worked past
 * midnight. Clamped to the two ends it cannot lie outside of: never before the
 * session began, never past the boundary the day was going to close at anyway.
 */
export function resolveEnd(hhmm: string, startedAt: Date, latest: Date): Date | null {
  const mins = minutesOfDay(hhmm)
  if (mins === null) return null

  const at = new Date(
    startedAt.getFullYear(),
    startedAt.getMonth(),
    startedAt.getDate(),
    0,
    0,
    0,
    0,
  )
  at.setMinutes(mins)
  if (at.getTime() <= startedAt.getTime()) at.setDate(at.getDate() + 1)

  if (at.getTime() < startedAt.getTime()) return new Date(startedAt.getTime())
  if (at.getTime() > latest.getTime()) return new Date(latest.getTime())
  return at
}

/** "HH:MM" for a Date, to prefill the time input with the app's own guess. */
export function hhmmOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
