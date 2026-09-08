import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { ApiError, allowCors, body, fail, json, methods } from './_http.js'
import { requireUser } from './_auth.js'

/**
 * The pain journal, server side (§ pivot).
 *
 * POST is a batch, idempotent on (user_id, client_id) exactly like /api/events:
 * the device queue must be replayable without duplicating an answer. That
 * matters more here than anywhere else in the app — a duplicated rating would
 * silently reweight the day mean the whole plan is dosed on.
 *
 * GET returns the whole history for the account, oldest first, so a second
 * device can merge it into its own journal rather than starting blank.
 *
 * Nothing is computed here. The score stored is the number the person put on
 * the slider, and no view, trigger or column derives anything from it: the
 * trend, the delta and the heatmap are all computed by the same pure functions
 * the screen uses (src/features/plan/painStats.ts), so the server and the phone
 * can never disagree about what a fortnight of answers means.
 */

const ZONES = new Set([
  'matin',
  'bureau',
  'nuque',
  'dos',
  'lombaires',
  'hanches',
  'poignets',
  'chevilles',
  'yeux',
  'bien-etre',
])
const SOURCES = new Set(['onboarding', 'post-session', 'manual'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BATCH = 500

interface Incoming {
  clientId?: unknown
  at?: unknown
  localDate?: unknown
  zone?: unknown
  score?: unknown
  source?: unknown
  routineSlug?: unknown
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    const method = methods(req, 'GET', 'POST')
    const { sub } = await requireUser(req)
    const sql = db()

    if (method === 'GET') {
      const rows = await sql`
        SELECT client_id, at, local_date, zone, score, source, routine_slug
        FROM pain_entries WHERE user_id = ${sub}
        ORDER BY at
      `
      json(
        res,
        200,
        rows.map((r) => ({
          clientId: r.client_id,
          at: new Date(r.at as string).toISOString(),
          localDate:
            typeof r.local_date === 'string'
              ? r.local_date
              : new Date(r.local_date as string).toISOString().slice(0, 10),
          zone: r.zone,
          score: Number(r.score),
          source: r.source,
          ...(r.routine_slug ? { routineSlug: r.routine_slug } : {}),
        })),
      )
      return
    }

    const raw = body<unknown>(req)
    const list = Array.isArray(raw) ? raw : (raw as { entries?: unknown }).entries
    if (!Array.isArray(list)) {
      throw new ApiError(400, 'invalid_input', 'Un tableau de réponses est attendu.')
    }
    if (list.length === 0) {
      json(res, 200, { inserted: 0 })
      return
    }
    if (list.length > MAX_BATCH) {
      throw new ApiError(400, 'too_many', 'Trop de réponses en une fois.')
    }

    let inserted = 0
    let skipped = 0
    for (const e of list as Incoming[]) {
      const clientId = str(e.clientId)
      const zone = str(e.zone)
      const source = str(e.source)
      const at = str(e.at)
      const localDate = str(e.localDate)
      const score = typeof e.score === 'number' ? Math.round(e.score) : NaN
      if (
        !UUID.test(clientId) ||
        !ZONES.has(zone) ||
        !SOURCES.has(source) ||
        !at ||
        !localDate ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > 10
      ) {
        // Skip the malformed row rather than failing the batch: the device
        // queue must always be able to drain, or one bad entry wedges every
        // answer behind it for ever.
        skipped++
        continue
      }
      const routineSlug = e.routineSlug ? str(e.routineSlug).slice(0, 120) : null

      try {
        const r = await sql`
          INSERT INTO pain_entries
            (client_id, user_id, at, local_date, zone, score, source, routine_slug)
          VALUES
            (${clientId}, ${sub}, ${at}, ${localDate}, ${zone}, ${score}, ${source},
             ${routineSlug})
          ON CONFLICT (user_id, client_id) DO NOTHING
          RETURNING id
        `
        if (r.length > 0) inserted++
      } catch (rowError) {
        skipped++
        console.warn('[pain] row rejected', rowError)
      }
    }

    json(res, 200, { inserted, skipped })
  } catch (e) {
    fail(res, e)
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
