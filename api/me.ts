import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { ApiError, allowCors, fail, json, methods } from './_http.js'
import { requireUser } from './_auth.js'
import { toPublicUser, toSettings } from './_models.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'GET')
    const { sub } = await requireUser(req)
    const sql = db()

    const users = await sql`
      SELECT id, email, display_name, created_at FROM users WHERE id = ${sub} LIMIT 1
    `
    const user = users[0]
    if (!user) throw new ApiError(404, 'no_user', 'Compte introuvable.')

    let settings = await sql`SELECT * FROM settings WHERE user_id = ${sub} LIMIT 1`
    if (settings.length === 0) {
      settings = await sql`INSERT INTO settings (user_id) VALUES (${sub}) RETURNING *`
    }

    json(res, 200, { user: toPublicUser(user), settings: toSettings(settings[0]!) })
  } catch (e) {
    fail(res, e)
  }
}
