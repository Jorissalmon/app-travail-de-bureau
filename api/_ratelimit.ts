/**
 * Fixed-window rate limiter in function memory (§6). A serverless instance may
 * be recycled or scaled out, so this is best-effort throttling, not a hard
 * guarantee — which is all the spec asks for on /auth/login.
 */
const windows = new Map<string, { count: number; resetAt: number }>()

/** Past this many tracked keys, expired windows are swept. */
const SWEEP_AT = 5_000

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  // The map only ever grew: one entry per client IP, kept for the life of the
  // instance. Rare in practice, since a function is recycled often, but a
  // long-lived one had no bound at all.
  if (windows.size > SWEEP_AT) {
    for (const [k, v] of windows) if (now >= v.resetAt) windows.delete(k)
  }
  const w = windows.get(key)
  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (w.count >= limit) return false
  w.count++
  return true
}
