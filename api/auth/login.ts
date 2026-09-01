import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../_db'
import { ApiError, body, clientIp, fail, json, methods } from '../_http'
import { issueRefreshToken, signAccessToken, verifyPassword } from '../_auth'
import { toPublicUser } from '../_models'
import { requireEmail } from '../_validate'
import { rateLimit } from '../_ratelimit'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    methods(req, 'POST')

    // 10 attempts per IP per 15 minutes, in function memory (§6). No Redis.
    if (!rateLimit(`login:${clientIp(req)}`, 10, 15 * 60_000)) {
      throw new ApiError(429, 'too_many', 'Trop de tentatives. Réessaie dans quelques minutes.')
    }

    const b = body<{ email?: unknown; password?: unknown }>(req)
    const email = requireEmail(b.email)
    const password = typeof b.password === 'string' ? b.password : ''

    const sql = db()
    const rows = await sql`
      SELECT id, email, display_name, created_at, password_hash
      FROM users WHERE email = ${email} LIMIT 1
    `
    const user = rows[0]
    // Same message and a hash comparison whether or not the user exists, so the
    // endpoint does not reveal which emails are registered.
    const ok = user
      ? await verifyPassword(password, user.password_hash as string)
      : await verifyPassword(password, '$2a$12$0000000000000000000000000000000000000000000000000000')
    if (!user || !ok) {
      throw new ApiError(401, 'bad_credentials', 'E-mail ou mot de passe incorrect.')
    }

    const accessToken = await signAccessToken({
      sub: user.id as string,
      email: user.email as string,
    })
    const refresh = await issueRefreshToken(user.id as string)

    json(res, 200, {
      user: toPublicUser(user),
      accessToken,
      refreshToken: refresh.token,
    })
  } catch (e) {
    fail(res, e)
  }
}
