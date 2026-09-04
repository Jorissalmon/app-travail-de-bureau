import type { Completion, ReminderEvent, Stats } from '@/lib/types'
import { computeAdherence, computeStreak, fillDays, withinDays, type DayCount } from './stats'

/**
 * The tracking screen, computed on the device from the journals.
 *
 * The numbers used to exist only on the server: no network, no figures — and no
 * account, no figures at all. That put the one screen that answers « est-ce que
 * ça change quelque chose ? » behind a sign-up form, which is the most
 * expensive thing an app can ask for before it has proved anything.
 *
 * The same pure rules the server uses (`./stats`), fed from the local journal
 * instead of Postgres. For someone signed in the server copy still wins once it
 * answers — it holds more than the journal's forty-five days — but nothing waits
 * on it.
 */

/** Reminder actions that count as having answered the reminder. */
const ADHERENCE_DAYS = 30

export interface LocalStatsInput {
  events: ReminderEvent[]
  completions: Completion[]
  today: string
  span: number
  /** The user's working days, so the streak is not reset by every weekend. */
  weekdays: number[]
}

export function buildLocalStats({
  events,
  completions,
  today,
  span,
  weekdays,
}: LocalStatsInput): Stats {
  const byDate = new Map<string, DayCount>()
  for (const e of events) {
    const day = byDate.get(e.localDate) ?? { localDate: e.localDate, stands: 0, reminders: 0 }
    day.reminders++
    if (e.action === 'done') day.stands++
    byDate.set(e.localDate, day)
  }
  const days = [...byDate.values()].sort((a, b) => a.localDate.localeCompare(b.localDate))

  const todayRow = byDate.get(today)
  const movedSeconds = completions
    .filter((c) => withinDays(c.localDate, today, span))
    .reduce((n, c) => n + c.durationS, 0)

  return {
    standsToday: todayRow?.stands ?? 0,
    remindersToday: todayRow?.reminders ?? 0,
    standsByDay: fillDays(days, today, span),
    streak: computeStreak(days, today, { weekdays }),
    minutesMoved: Math.round(movedSeconds / 60),
    adherence: computeAdherence(
      events.filter((e) => withinDays(e.localDate, today, ADHERENCE_DAYS)),
    ),
  }
}
