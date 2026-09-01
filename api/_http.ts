import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Tiny HTTP helpers shared by the serverless functions. Errors are returned in
 * the { error: { code, message } } shape with a French, directly-displayable
 * message (§6).
 */

export function json(res: VercelResponse, status: number, body: unknown): void {
  setCors(res)
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.send(JSON.stringify(body))
}

/**
 * CORS. The Android webview serves the app from https://localhost and calls the
 * API on the Vercel domain, so every request is cross-origin and the browser
 * sends an OPTIONS preflight first. Without these headers the preflight is
 * rejected and fetch fails before the request is ever made.
 *
 * `*` is safe here: auth is a bearer token, never a cookie, so a third-party
 * page cannot ride on an ambient session.
 */
export function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

/**
 * Sets CORS headers and answers the preflight. Returns true when the request
 * was an OPTIONS preflight and the response is already finished — the caller
 * must return immediately in that case.
 */
export function allowCors(req: VercelRequest, res: VercelResponse): boolean {
  setCors(res)
  if ((req.method ?? '').toUpperCase() === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function fail(res: VercelResponse, e: unknown): void {
  if (e instanceof ApiError) {
    json(res, e.status, { error: { code: e.code, message: e.message } })
    return
  }
  console.error('unhandled error', e)
  json(res, 500, {
    error: { code: 'internal', message: 'Une erreur est survenue. Réessaie plus tard.' },
  })
}

/** Enforce the HTTP method(s); throws a 405 otherwise. */
export function methods(req: VercelRequest, ...allowed: string[]): string {
  const m = (req.method ?? 'GET').toUpperCase()
  if (!allowed.includes(m)) {
    throw new ApiError(405, 'method_not_allowed', 'Méthode non autorisée.')
  }
  return m
}

/** Parse the JSON body defensively — Vercel usually parses it, but not always. */
export function body<T = Record<string, unknown>>(req: VercelRequest): T {
  const b = req.body
  if (b == null) return {} as T
  if (typeof b === 'string') {
    try {
      return JSON.parse(b) as T
    } catch {
      throw new ApiError(400, 'bad_json', 'Requête invalide.')
    }
  }
  return b as T
}

/** Best-effort client IP for rate limiting. */
export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0]!.trim()
  if (Array.isArray(fwd)) return fwd[0] ?? 'unknown'
  return req.socket?.remoteAddress ?? 'unknown'
}
