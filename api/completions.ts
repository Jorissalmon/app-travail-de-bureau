import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { ApiError, allowCors, body, fail, json, methods } from './_http.js'
import { requireUser } from './_auth.js'

/**
 * Batch, idempotent routine-completion ingestion. Not in the original API table
 * but backed by the `completions` table the schema defines and /api/stats reads
 * (minutesMoved). Same offline-queue contract as /api/events: unique
 * (user_id, client_id) makes replays safe. See DECISIONS.md.
 */

interface IncomingCompletion {
  clientId?: unknown
  routineSlug?: unknown
  completedAt?: unknown
  durationS?: unknown
  localDate?: unknown
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'POST')
    const { sub } = await requireUser(req)

    const raw = body<unknown>(req)
    const items = Array.isArray(raw) ? raw : (raw as { completions?: unknown }).completions
    if (!Array.isArray(items)) {
      throw new ApiError(400, 'invalid_input', 'Un tableau de complétions est attendu.')
    }
    if (items.length > 500) throw new ApiError(400, 'too_many', 'Trop d’éléments en une fois.')

    const sql = db()
    let inserted = 0
    let skipped = 0

    for (const c of items as IncomingCompletion[]) {
      const clientId = str(c.clientId)
      const completedAt = str(c.completedAt)
      const localDate = str(c.localDate)
      const durationS = Number(c.durationS)
      const slug = str(c.routineSlug)
      if (!clientId || !completedAt || !localDate || Number.isNaN(durationS)) continue

      try {
        const r = await sql`
          INSERT INTO completions (client_id, user_id, routine_id, completed_at, duration_s, local_date)
          VALUES (
            ${clientId}, ${sub},
            (SELECT id FROM routines WHERE slug = ${slug} LIMIT 1),
            ${completedAt}, ${durationS}, ${localDate}
          )
          ON CONFLICT (user_id, client_id) DO NOTHING
          RETURNING id
        `
        if (r.length > 0) inserted++
      } catch (rowError) {
        // Same rule as /api/events: a row the database refuses is dropped, not
        // allowed to wedge everything queued behind it.
        skipped++
        console.warn('[completions] row rejected', rowError)
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
