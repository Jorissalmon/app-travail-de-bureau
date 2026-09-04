import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { allowCors, fail, json, methods } from './_http.js'
import { requireUser } from './_auth.js'
import {
  computeAdherence,
  computeStreak,
  fillDays,
  type DayCount,
} from '../src/features/session/stats.js'
import type { ReminderAction } from '../src/lib/types.js'

/**
 * §11.5 — four honest numbers: stands today, a 7-day bar series, the streak, and
 * the 30-day response rate. No invented health figures.
 *
 * `today` is taken from the client (device timezone) via ?today=, falling back
 * to server UTC only if absent — days must be counted in the user's own day.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'GET')
    const { sub } = await requireUser(req)
    const sql = db()

    const range = req.query.range === 'month' ? 'month' : 'week'
    const span = range === 'month' ? 30 : 7
    const today =
      typeof req.query.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.today)
        ? req.query.today
        : new Date().toISOString().slice(0, 10)

    // Per-day counts over the last 31 days (enough for the streak + range).
    const dayRows = await sql`
      SELECT local_date::text AS local_date,
             COUNT(*) FILTER (WHERE action = 'done')                        AS stands,
             COUNT(*)                                                        AS reminders
      FROM reminder_events
      WHERE user_id = ${sub}
        AND local_date > (${today}::date - INTERVAL '31 days')
        AND local_date <= ${today}::date
      GROUP BY local_date
      ORDER BY local_date
    `
    const days: DayCount[] = dayRows.map((r) => ({
      localDate: String(r.local_date).slice(0, 10),
      stands: Number(r.stands),
      reminders: Number(r.reminders),
    }))

    const todayRow = days.find((d) => d.localDate === today)
    const standsToday = todayRow?.stands ?? 0
    const remindersToday = todayRow?.reminders ?? 0

    // 30-day adherence over every reminder event.
    const actionRows = await sql`
      SELECT action FROM reminder_events
      WHERE user_id = ${sub}
        AND local_date > (${today}::date - INTERVAL '30 days')
        AND local_date <= ${today}::date
    `
    const adherence = computeAdherence(
      actionRows.map((r) => ({ action: r.action as ReminderAction })),
    )

    // Minutes moved: sum of completed break durations over the range.
    const movedRows = await sql`
      SELECT COALESCE(SUM(duration_s), 0) AS secs
      FROM completions
      WHERE user_id = ${sub}
        AND local_date > (${today}::date - (${span}::text || ' days')::interval)
        AND local_date <= ${today}::date
    `
    const minutesMoved = Math.round(Number(movedRows[0]?.secs ?? 0) / 60)

    // The streak has to know which days the user actually works. Without it a
    // Monday-to-Friday user reset to zero every Saturday and could never see a
    // number above five.
    const settingsRows = await sql`
      SELECT weekdays FROM settings WHERE user_id = ${sub} LIMIT 1
    `
    const weekdays = (settingsRows[0]?.weekdays as number[] | undefined)?.map(Number) ?? []

    json(res, 200, {
      standsToday,
      remindersToday,
      standsByDay: fillDays(days, today, span),
      streak: computeStreak(days, today, { weekdays }),
      minutesMoved,
      adherence,
    })
  } catch (e) {
    fail(res, e)
  }
}
