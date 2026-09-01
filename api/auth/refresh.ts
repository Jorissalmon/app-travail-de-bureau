import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowCors, body, fail, json, methods } from '../_http.js'
import { rotateRefreshToken, signAccessToken } from '../_auth.js'
import { requireString } from '../_validate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
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
