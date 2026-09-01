/**
 * Fixed-window rate limiter in function memory (§6). A serverless instance may
 * be recycled or scaled out, so this is best-effort throttling, not a hard
 * guarantee — which is all the spec asks for on /auth/login.
 */
const windows = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const w = windows.get(key)
  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (w.count >= limit) return false
  w.count++
  return true
}
