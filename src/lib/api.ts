import { KEYS, getRaw, remove, setRaw } from './storage'
import type { ApiError } from './types'

/**
 * Hand-rolled fetch wrapper. No React Query: the app has eight endpoints and a
 * single refresh rule, and a library would be more code than this file.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

/**
 * Raised in place of a request when the device has no account at all.
 *
 * Its status is 0, so `isOffline()` reports it as a network failure and every
 * caller already written to sync opportunistically stays silent — which is
 * exactly the behaviour local mode needs. Without it, a device with no tokens
 * ran the whole refresh dance on every call and ended up firing the auth-lost
 * listener, kicking someone who never wanted an account to the login screen.
 */
export class NoAccountError extends HttpError {
  constructor() {
    super(0, 'no_account', 'Aucun compte sur cet appareil.')
    this.name = 'NoAccountError'
  }
}

/** Raised when refreshing failed and the user has to sign in again. */
export class AuthExpiredError extends HttpError {
  constructor() {
    super(401, 'auth_expired', 'Ta session a expiré. Reconnecte-toi.')
    this.name = 'AuthExpiredError'
  }
}

type Listener = () => void
const authLostListeners = new Set<Listener>()

/** Notified when the refresh token is gone for good, so the UI can route to /login. */
export function onAuthLost(fn: Listener): () => void {
  authLostListeners.add(fn)
  return () => authLostListeners.delete(fn)
}

// ---------------------------------------------------------------------------
// Token plumbing
// ---------------------------------------------------------------------------

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await setRaw(KEYS.accessToken, accessToken)
  await setRaw(KEYS.refreshToken, refreshToken)
}

/**
 * Drops the tokens only. Settings and the pending event queue are deliberately
 * left alone (§7): signing out must not lose a day of reminders.
 */
export async function clearTokens(): Promise<void> {
  await remove(KEYS.accessToken)
  await remove(KEYS.refreshToken)
}

export async function hasSessionTokens(): Promise<boolean> {
  return (await getRaw(KEYS.refreshToken)) !== null
}

// A single in-flight refresh, shared by every 401 that lands while it runs.
// Without this, a screen firing three requests at once would burn three
// rotations and invalidate its own tokens.
let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refreshToken = await getRaw(KEYS.refreshToken)
    if (!refreshToken) return null
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { accessToken: string; refreshToken: string }
      await setTokens(data.accessToken, data.refreshToken)
      return data.accessToken
    } catch {
      // Offline. Not an auth failure — keep the tokens and let the caller retry
      // later (§C5: sync is opportunistic, never blocking).
      return null
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  /** Skip the Authorization header and the refresh dance (auth routes). */
  anonymous?: boolean
  signal?: AbortSignal
}

async function raw(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  return fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  })
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  // Nothing to authenticate with, and nothing to refresh: do not touch the
  // network at all. Signing in and registering are exempt — they are how an
  // account comes to exist in the first place.
  if (!opts.anonymous && !(await hasSessionTokens())) throw new NoAccountError()

  let token = opts.anonymous ? null : await getRaw(KEYS.accessToken)

  let res = await raw(path, opts, token)

  // One retry, and only one: refresh then replay.
  if (res.status === 401 && !opts.anonymous) {
    const fresh = await refreshAccessToken()
    if (fresh === null) {
      const stillHasRefresh = await getRaw(KEYS.refreshToken)
      if (!stillHasRefresh) {
        for (const fn of authLostListeners) fn()
        throw new AuthExpiredError()
      }
      throw new HttpError(401, 'unauthorized', 'Connexion impossible pour le moment.')
    }
    token = fresh
    res = await raw(path, opts, token)
    if (res.status === 401) {
      await clearTokens()
      for (const fn of authLostListeners) fn()
      throw new AuthExpiredError()
    }
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()

  // A non-JSON body means we did not reach the API at all — typically an HTML
  // error page because the function is missing or the route is wrong. Surface
  // that as a real error instead of letting JSON.parse throw a SyntaxError,
  // which the UI would otherwise report as a generic network failure.
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new HttpError(
        res.status,
        'bad_response',
        `Réponse inattendue du serveur (${res.status}). L’API est-elle bien déployée ?`,
      )
    }
  }

  if (!res.ok) {
    const err = (data as ApiError | null)?.error
    throw new HttpError(
      res.status,
      err?.code ?? 'unknown',
      err?.message ?? 'Une erreur est survenue.',
    )
  }

  return data as T
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  /**
   * A GET on an endpoint that needs no account. The content routes are public,
   * and without this a device in local mode would never see a content
   * correction: NoAccountError cuts the request off before it is made.
   */
  getPublic: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { signal, anonymous: true }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  postAnonymous: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body, anonymous: true }),
}

/** True when the failure was the network, not the server. */
export function isOffline(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof HttpError && e.status === 0)
}
