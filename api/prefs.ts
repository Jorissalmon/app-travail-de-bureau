import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { ApiError, allowCors, body, fail, json, methods } from './_http.js'
import { requireUser } from './_auth.js'

/**
 * The preferences that used to live only on the device: routines the user
 * composed, per-step durations, the timer's cues.
 *
 * Stored as one opaque blob of storage-key → stored string, because that is
 * exactly what the device already holds — the sync has nothing to translate,
 * and adding a preference later costs no migration and no deploy order.
 *
 * The server arbitrates nothing: it keeps the newest blob it was given and
 * hands it back. Last writer wins, which is the right rule for one person and
 * their phone and their laptop, and the wrong one for a shared account — worth
 * revisiting the day accounts are shared.
 */

/** Refuse a blob big enough to be a mistake or an attack. 256 KB of prefs is
    already far past a few dozen routines. */
const MAX_BYTES = 256 * 1024

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    const m = methods(req, 'GET', 'PUT')
    const { sub } = await requireUser(req)
    const sql = db()

    if (m === 'GET') {
      const rows = await sql`SELECT data, updated_at FROM user_prefs WHERE user_id = ${sub} LIMIT 1`
      const row = rows[0]
      json(res, 200, {
        data: (row?.data as Record<string, string> | undefined) ?? {},
        // No row yet means nothing has ever been synced: the epoch makes any
        // device's own copy newer, so the first sync uploads rather than wipes.
        updatedAt: row ? new Date(row.updated_at as string).toISOString() : new Date(0).toISOString(),
      })
      return
    }

    const b = body<{ data?: unknown; updatedAt?: unknown }>(req)
    const data = b.data
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'invalid_input', 'Préférences invalides.')
    }
    const entries = Object.entries(data as Record<string, unknown>)
    for (const [key, value] of entries) {
      if (typeof value !== 'string') {
        throw new ApiError(400, 'invalid_input', `Préférence « ${key} » invalide.`)
      }
    }
    const serialised = JSON.stringify(data)
    if (Buffer.byteLength(serialised, 'utf8') > MAX_BYTES) {
      throw new ApiError(413, 'too_large', 'Préférences trop volumineuses.')
    }

    const rows = await sql`
      INSERT INTO user_prefs (user_id, data, updated_at)
      VALUES (${sub}, ${serialised}::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      RETURNING data, updated_at
    `
    const row = rows[0]!
    json(res, 200, {
      data: row.data as Record<string, string>,
      updatedAt: new Date(row.updated_at as string).toISOString(),
    })
  } catch (e) {
    fail(res, e)
  }
}
