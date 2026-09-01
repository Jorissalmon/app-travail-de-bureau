import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { ApiError, allowCors, body, fail, json, methods } from './_http.js'
import { requireUser } from './_auth.js'
import { requireString } from './_validate.js'

/**
 * Start or stop a work session. The client sends `localDate` (computed from the
 * device timezone) and `at` — the server never derives the day from now()::date
 * (§5). Stop is idempotent: stopping an already-stopped or absent session just
 * returns the latest one.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'POST')
    const { sub } = await requireUser(req)
    const b = body<{ action?: unknown; at?: unknown; localDate?: unknown }>(req)

    const action = requireString(b.action, 'action', 10)
    const at = requireString(b.at, 'at', 40)
    const localDate = requireString(b.localDate, 'localDate', 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      throw new ApiError(400, 'invalid_input', 'Date locale invalide.')
    }
    const atIso = new Date(at)
    if (Number.isNaN(atIso.getTime())) {
      throw new ApiError(400, 'invalid_input', 'Horodatage invalide.')
    }

    const sql = db()

    if (action === 'start') {
      const rows = await sql`
        INSERT INTO work_sessions (user_id, started_at, local_date)
        VALUES (${sub}, ${atIso.toISOString()}, ${localDate})
        RETURNING id, started_at, ended_at, local_date
      `
      json(res, 201, { session: mapSession(rows[0]!) })
      return
    }

    if (action === 'stop') {
      // End the most recent open session for the day, if any.
      const rows = await sql`
        UPDATE work_sessions
        SET ended_at = ${atIso.toISOString()}
        WHERE id = (
          SELECT id FROM work_sessions
          WHERE user_id = ${sub} AND ended_at IS NULL
          ORDER BY started_at DESC LIMIT 1
        )
        RETURNING id, started_at, ended_at, local_date
      `
      const latest =
        rows[0] ??
        (
          await sql`
            SELECT id, started_at, ended_at, local_date FROM work_sessions
            WHERE user_id = ${sub} ORDER BY started_at DESC LIMIT 1
          `
        )[0]
      json(res, 200, { session: latest ? mapSession(latest) : null })
      return
    }

    throw new ApiError(400, 'invalid_input', 'Action inconnue.')
  } catch (e) {
    fail(res, e)
  }
}

function mapSession(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    startedAt: (row.started_at as Date | string).toString(),
    endedAt: row.ended_at ? (row.ended_at as Date | string).toString() : null,
    localDate: (row.local_date as Date | string).toString().slice(0, 10),
  }
}
