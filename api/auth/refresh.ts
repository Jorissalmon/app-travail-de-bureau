import type { VercelRequest, VercelResponse } from '@vercel/node'
import { body, fail, json, methods } from '../_http'
import { rotateRefreshToken, signAccessToken } from '../_auth'
import { requireString } from '../_validate'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    methods(req, 'POST')
    const b = body<{ refreshToken?: unknown }>(req)
    const presented = requireString(b.refreshToken, 'refreshToken', 200)

    const { userId, email, refresh } = await rotateRefreshToken(presented)
    const accessToken = await signAccessToken({ sub: userId, email })

    json(res, 200, { accessToken, refreshToken: refresh.token })
  } catch (e) {
    fail(res, e)
  }
}
