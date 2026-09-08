import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { ApiError, allowCors, body, fail, json, methods } from './_http.js'
import { requireUser } from './_auth.js'

/**
 * Analytics ingestion (§ pivot, docs/VALIDATION-PIVOT.md).
 *
 * The four numbers the pivot is judged on cannot be computed from anything
 * else, so this endpoint exists — and it is written to be the narrowest one in
 * the app rather than the widest.
 *
 * Three rules, which are the content doctrine applied to measurement:
 *
 * 1. **A closed vocabulary of names.** An event whose name is not in NAMES is
 *    dropped. A client cannot invent a new event by sending one, and the list
 *    below is auditable against the union in src/features/analytics/events.ts.
 * 2. **No free text, enforced here and not only in the client.** Every string
 *    in a payload is capped at MAX_STRING and only scalars are kept — an object
 *    or an array in a payload is dropped. A typed union on the device is a
 *    convention; this is the part that holds when someone posts by hand.
 * 3. **Idempotent on (user_id, client_id)**, like every other queue in the app,
 *    so a replayed batch cannot inflate a completion rate.
 */

/** Exactly the union in src/features/analytics/events.ts. Keep the two in step. */
const NAMES = new Set([
  'onboarding_started',
  'onboarding_step',
  'onboarding_completed',
  'onboarding_abandoned',
  'plan_shown',
  'session_started',
  'session_completed',
  'session_abandoned',
  'pain_rated',
  'pain_skipped',
  'plan_adapted',
  'reminder_acted',
  'reminder_backoff',
  'streak_freeze_used',
  'place_changed',
  'article_opened',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BATCH = 500
/** Long enough for a slug, far too short for anything a human wrote. */
const MAX_STRING = 120
const MAX_KEYS = 12

interface Incoming {
  clientId?: unknown
  at?: unknown
  localDate?: unknown
  name?: unknown
  payload?: unknown
}

/**
 * Keep the scalars, drop everything else.
 *
 * Not defensive programming for its own sake: the promise made in the app and
 * in the validation document is that no free text and no nested structure is
 * ever collected. A payload sanitised only on the device is a promise that
 * holds until the first person with a debugger.
 */
function scalarsOnly(v: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out
  for (const [key, value] of Object.entries(v)) {
    if (Object.keys(out).length >= MAX_KEYS) break
    if (key.length > 40) continue
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (typeof value === 'boolean') out[key] = value
    else if (typeof value === 'string') out[key] = value.slice(0, MAX_STRING)
  }
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'POST')
    const { sub } = await requireUser(req)

    const raw = body<unknown>(req)
    const list = Array.isArray(raw) ? raw : (raw as { events?: unknown }).events
    if (!Array.isArray(list)) {
      throw new ApiError(400, 'invalid_input', 'Un tableau d’événements est attendu.')
    }
    if (list.length === 0) {
      json(res, 200, { inserted: 0 })
      return
    }
    if (list.length > MAX_BATCH) {
      throw new ApiError(400, 'too_many', 'Trop d’événements en une fois.')
    }

    const sql = db()
    let inserted = 0
    let skipped = 0

    for (const e of list as Incoming[]) {
      const clientId = typeof e.clientId === 'string' ? e.clientId : ''
      const name = typeof e.name === 'string' ? e.name : ''
      const at = typeof e.at === 'string' ? e.at : ''
      const localDate = typeof e.localDate === 'string' ? e.localDate : ''
      if (!UUID.test(clientId) || !NAMES.has(name) || !at || !localDate) {
        skipped++
        continue
      }

      try {
        const r = await sql`
          INSERT INTO analytics_events (client_id, user_id, at, local_date, name, payload)
          VALUES (${clientId}, ${sub}, ${at}, ${localDate}, ${name},
                  ${JSON.stringify(scalarsOnly(e.payload))}::jsonb)
          ON CONFLICT (user_id, client_id) DO NOTHING
          RETURNING id
        `
        if (r.length > 0) inserted++
      } catch (rowError) {
        // One bad row must never wedge the queue behind it.
        skipped++
        console.warn('[analytics] row rejected', rowError)
      }
    }

    json(res, 200, { inserted, skipped })
  } catch (e) {
    fail(res, e)
  }
}
