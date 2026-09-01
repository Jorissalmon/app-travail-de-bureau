import { addDays, daysBetween } from '../../lib/date.js'
import type { ReminderAction } from '../../lib/types.js'

/**
 * Pure statistics used by both the server (/api/stats) and, as a fallback, the
 * client. Kept free of I/O so the streak and adherence rules can be unit-tested
 * (§13.3). A "stand" here means the user acted on a reminder with 'done'.
 */

export interface DayCount {
  localDate: string
  stands: number
  reminders: number
}

/** §11.5 — a day counts toward the streak when it has at least this many stands. */
export const STREAK_THRESHOLD = 3

/** §11.5 — below this 30-day response rate, the UI offers a longer interval. */
export const LOW_ADHERENCE = 0.4

/**
 * Consecutive days, ending today, with at least STREAK_THRESHOLD stands.
 * Today not yet meeting the threshold does not break a streak built up to
 * yesterday — the day is still in progress.
 */
export function computeStreak(days: DayCount[], today: string): number {
  const stands = new Map(days.map((d) => [d.localDate, d.stands]))
  let streak = 0
  let cursor = today

  // If today is not yet a qualifying day, start counting from yesterday so the
  // streak reflects completed days.
  if ((stands.get(today) ?? 0) < STREAK_THRESHOLD) {
    cursor = addDays(today, -1)
  }
  while ((stands.get(cursor) ?? 0) >= STREAK_THRESHOLD) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/**
 * Share of reminders that were acted on (done or snoozed) over a window.
 * 'expired' and 'dismissed' count against it. Returns null when no reminder
 * fired, so the UI can show "—" rather than 0 %.
 */
export function computeAdherence(
  events: { action: ReminderAction }[],
): number | null {
  if (events.length === 0) return null
  const acted = events.filter((e) => e.action === 'done' || e.action === 'snoozed').length
  return acted / events.length
}

/** Total minutes moved: one completed break ≈ its actual duration in seconds. */
export function minutesFromSeconds(totalSeconds: number): number {
  return Math.round(totalSeconds / 60)
}

/**
 * Build the last-N-days series ending today, filling gaps with zeroes so the
 * bar chart always has one bar per day (§11.5).
 */
export function fillDays(days: DayCount[], today: string, span: number): DayCount[] {
  const byDate = new Map(days.map((d) => [d.localDate, d]))
  const out: DayCount[] = []
  for (let i = span - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    out.push(byDate.get(date) ?? { localDate: date, stands: 0, reminders: 0 })
  }
  return out
}

/** Guard used by the chart: how many days a range covers. */
export function rangeToSpan(range: 'week' | 'month'): number {
  return range === 'month' ? 30 : 7
}

export function withinDays(dateStr: string, today: string, span: number): boolean {
  const diff = daysBetween(dateStr, today)
  return diff >= 0 && diff < span
}
