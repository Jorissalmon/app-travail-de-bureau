import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db'
import { ApiError, body, fail, json, methods } from './_http'
import { requireUser } from './_auth'

/**
 * Batch, idempotent reminder-event ingestion (§6). Each event carries a
 * client-generated clientId; the unique index (user_id, client_id) lets the
 * offline queue be replayed without creating duplicates.
 */

const KINDS = new Set(['stand', 'eyes', 'mobility'])
const ACTIONS = new Set(['done', 'snoozed', 'dismissed', 'expired'])

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
      const sessionId = e.sessionId ? str(e.sessionId) : null
      const actedAt = e.actedAt ? str(e.actedAt) : null

      const r = await sql`
        INSERT INTO reminder_events
          (client_id, user_id, session_id, kind, fired_at, action, acted_at, local_date)
        VALUES
          (${clientId}, ${sub}, ${sessionId}, ${kind}::reminder_kind, ${firedAt},
           ${action}::reminder_action, ${actedAt}, ${localDate})
        ON CONFLICT (user_id, client_id) DO NOTHING
        RETURNING id
      `
      if (r.length > 0) inserted++
    }

    json(res, 200, { inserted })
  } catch (e) {
    fail(res, e)
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
