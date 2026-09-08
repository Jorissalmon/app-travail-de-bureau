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
import { buildJournal, type WorkSpan } from '../src/features/session/journal.js'
import type { Completion, ReminderAction, ReminderEvent } from '../src/lib/types.js'

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

    // The journal: what happened, in order, over the range on screen. Days come
    // from work_sessions — the one thing the device's own journals cannot know
    // once a day was started somewhere else.
    const sessionRows = await sql`
      SELECT started_at, ended_at, local_date::text AS local_date
      FROM work_sessions
      WHERE user_id = ${sub}
        AND local_date > (${today}::date - (${span}::text || ' days')::interval)
        AND local_date <= ${today}::date
      ORDER BY started_at
    `
    const sessions: WorkSpan[] = sessionRows.map((r) => ({
      startedAt: new Date(r.started_at as string).toISOString(),
      endedAt: r.ended_at ? new Date(r.ended_at as string).toISOString() : null,
      localDate: String(r.local_date).slice(0, 10),
    }))

    const eventRows = await sql`
      SELECT client_id, kind, fired_at, action, acted_at, local_date::text AS local_date
      FROM reminder_events
      WHERE user_id = ${sub}
        AND local_date > (${today}::date - (${span}::text || ' days')::interval)
        AND local_date <= ${today}::date
      ORDER BY fired_at
    `
    const journalEvents = eventRows.map((r) => ({
      clientId: String(r.client_id),
      sessionId: null,
      kind: r.kind,
      firedAt: new Date(r.fired_at as string).toISOString(),
      action: r.action,
      actedAt: r.acted_at ? new Date(r.acted_at as string).toISOString() : null,
      localDate: String(r.local_date).slice(0, 10),
    })) as ReminderEvent[]

    const completionRows = await sql`
      SELECT c.client_id, r.slug AS routine_slug, c.completed_at, c.duration_s,
             c.local_date::text AS local_date
      FROM completions c
      LEFT JOIN routines r ON r.id = c.routine_id
      WHERE c.user_id = ${sub}
        AND c.local_date > (${today}::date - (${span}::text || ' days')::interval)
        AND c.local_date <= ${today}::date
      ORDER BY c.completed_at
    `
    const journalCompletions = completionRows.map((r) => ({
      clientId: String(r.client_id),
      routineId: null,
      routineSlug: r.routine_slug ? String(r.routine_slug) : '',
      completedAt: new Date(r.completed_at as string).toISOString(),
      durationS: Number(r.duration_s),
      localDate: String(r.local_date).slice(0, 10),
    })) as Completion[]

    json(res, 200, {
      standsToday,
      remindersToday,
      standsByDay: fillDays(days, today, span),
      streak: computeStreak(days, today, { weekdays }),
      minutesMoved,
      adherence,
      journal: buildJournal({
        sessions,
        events: journalEvents,
        completions: journalCompletions,
        today,
        span,
        now: new Date().toISOString(),
      }),
    })
  } catch (e) {
    fail(res, e)
  }
}
