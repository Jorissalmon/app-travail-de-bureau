import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { ApiError, allowCors, body, fail, json, methods } from './_http.js'
import { requireUser } from './_auth.js'

/**
 * Batch, idempotent reminder-event ingestion (§6). Each event carries a
 * client-generated clientId; the unique index (user_id, client_id) lets the
 * offline queue be replayed without creating duplicates.
 */

const KINDS = new Set(['stand', 'eyes', 'mobility'])
const ACTIONS = new Set(['done', 'snoozed', 'dismissed', 'expired'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface IncomingEvent {
  clientId?: unknown
  sessionId?: unknown
  kind?: unknown
  firedAt?: unknown
  action?: unknown
  actedAt?: unknown
  localDate?: unknown
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'POST')
    const { sub } = await requireUser(req)

    const raw = body<unknown>(req)
    const events = Array.isArray(raw) ? raw : (raw as { events?: unknown }).events
    if (!Array.isArray(events)) {
      throw new ApiError(400, 'invalid_input', 'Un tableau d’événements est attendu.')
    }
    if (events.length === 0) {
      json(res, 200, { inserted: 0 })
      return
    }
    if (events.length > 500) {
      throw new ApiError(400, 'too_many', 'Trop d’événements en une fois.')
    }

    const sql = db()
    let inserted = 0
    let skipped = 0

    for (const e of events as IncomingEvent[]) {
      const clientId = str(e.clientId)
      const kind = str(e.kind)
      const action = str(e.action)
      const firedAt = str(e.firedAt)
      const localDate = str(e.localDate)
      if (!clientId || !KINDS.has(kind) || !ACTIONS.has(action) || !firedAt || !localDate) {
        // Skip malformed rows rather than failing the whole batch — the queue
        // must always be able to drain.
        continue
      }
      const actedAt = e.actedAt ? str(e.actedAt) : null
      // The session id is resolved against this user's own sessions rather than
      // trusted. Two reasons, and the first is not theoretical: until the
      // server confirms a start, the device holds a uuid IT generated, and a
      // start that failed (offline, a 500, an expired token) leaves it holding
      // that uuid for the whole day. Inserting it violates the foreign key,
      // which fails the request, which means the offline queue can never drain
      // again. The second is that nothing otherwise stopped a client from
      // attaching its events to somebody else's session.
      const claimed = e.sessionId ? str(e.sessionId) : ''
      const sessionId = UUID.test(claimed) ? claimed : null

      try {
        const r = await sql`
          INSERT INTO reminder_events
            (client_id, user_id, session_id, kind, fired_at, action, acted_at, local_date)
          VALUES
            (${clientId}, ${sub},
             (SELECT id FROM work_sessions WHERE id = ${sessionId} AND user_id = ${sub}),
             ${kind}::reminder_kind, ${firedAt},
             ${action}::reminder_action, ${actedAt}, ${localDate})
          ON CONFLICT (user_id, client_id) DO NOTHING
          RETURNING id
        `
        if (r.length > 0) inserted++
      } catch (rowError) {
        // One bad row must never block the queue: the client replays the whole
        // batch, so a row that fails forever would wedge every later event
        // behind it. Counted and logged, not fatal.
        skipped++
        console.warn('[events] row rejected', rowError)
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
