import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../_db.js'
import { ApiError, allowCors, body, fail, json, methods } from '../_http.js'
import { hashPassword, issueRefreshToken, signAccessToken } from '../_auth.js'
import { toPublicUser } from '../_models.js'
import { requireEmail, requirePassword, requireString } from '../_validate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'POST')
    const b = body<{
      email?: unknown
      password?: unknown
      displayName?: unknown
      inviteCode?: unknown
    }>(req)

    // The app is not open to the public, but registering must stay possible
    // without a redeploy (§6): the code lives in an env var.
    const expected = process.env.INVITE_CODE
    if (!expected) {
      throw new ApiError(403, 'registration_closed', 'Les inscriptions sont fermées.')
    }
    if (requireString(b.inviteCode, 'code d’invitation', 200) !== expected) {
      throw new ApiError(403, 'bad_invite', 'Ce code d’invitation n’est pas valide.')
    }

    const email = requireEmail(b.email)
    const password = requirePassword(b.password)
    const displayName = requireString(b.displayName, 'nom', 80)

    const sql = db()
    const existing = await sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`
    if (existing.length > 0) {
      throw new ApiError(409, 'email_taken', 'Un compte existe déjà avec cette adresse.')
    }

    const passwordHash = await hashPassword(password)
    const rows = await sql`
      INSERT INTO users (email, password_hash, display_name)
      VALUES (${email}, ${passwordHash}, ${displayName})
      RETURNING id, email, display_name, created_at
    `
    const user = rows[0]!
    // Seed default settings so /api/me always returns a full object.
    await sql`INSERT INTO settings (user_id) VALUES (${user.id as string})
              ON CONFLICT (user_id) DO NOTHING`

    const accessToken = await signAccessToken({
      sub: user.id as string,
      email: user.email as string,
    })
    const refresh = await issueRefreshToken(user.id as string)

    json(res, 201, {
      user: toPublicUser(user),
      accessToken,
      refreshToken: refresh.token,
    })
  } catch (e) {
    fail(res, e)
  }
}
