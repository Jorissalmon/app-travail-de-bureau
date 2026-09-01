import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { VercelRequest } from '@vercel/node'
import { db } from './_db.js'
import { ApiError } from './_http.js'

/**
 * Auth (§7). Passwords: bcrypt cost 12. Access token: JWT, 15 min. Refresh
 * token: 32 random bytes, stored only as a SHA-256 hash, 90 days, rotated on
 * every use.
 */

const ACCESS_TTL_SEC = 15 * 60
const REFRESH_TTL_DAYS = 90
const BCRYPT_COST = 12

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not configured')
  return new TextEncoder().encode(s)
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export interface AccessClaims {
  sub: string
  email: string
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret())
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return { sub: String(payload.sub), email: String(payload.email ?? '') }
  } catch {
    throw new ApiError(401, 'invalid_token', 'Ta session a expiré. Reconnecte-toi.')
  }
}

// --- Refresh tokens --------------------------------------------------------

export interface RefreshToken {
  /** The opaque secret handed to the client. Never stored server-side. */
  token: string
  hash: string
  expiresAt: Date
}

export function newRefreshToken(): RefreshToken {
  const token = randomBytes(32).toString('base64url')
  const hash = hashToken(token)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000)
  return { token, hash, expiresAt }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Read and verify the bearer token; returns the authenticated user id. */
export async function requireUser(req: VercelRequest): Promise<AccessClaims> {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'no_token', 'Connecte-toi pour continuer.')
  }
  return verifyAccessToken(header.slice('Bearer '.length))
}

/**
 * Rotate a refresh token: verify it exists, is unrevoked and unexpired, revoke
 * it, and issue a fresh one. Returns the user id and the new token pair.
 */
export async function rotateRefreshToken(
  presented: string,
): Promise<{ userId: string; email: string; refresh: RefreshToken }> {
  const sql = db()
  const hash = hashToken(presented)
  const rows = await sql`
    SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.email
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token_hash = ${hash}
    LIMIT 1
  `
  const row = rows[0]
  if (!row || row.revoked_at !== null || new Date(row.expires_at as string) < new Date()) {
    throw new ApiError(401, 'invalid_refresh', 'Ta session a expiré. Reconnecte-toi.')
  }

  const refresh = newRefreshToken()
  // Revoke the old, insert the new. Two statements; the unique presented hash
  // makes a replayed old token a no-op on the second attempt.
  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE id = ${row.id as string}`
  await sql`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (${row.user_id as string}, ${refresh.hash}, ${refresh.expiresAt.toISOString()})
  `
  return { userId: row.user_id as string, email: row.email as string, refresh }
}

export async function issueRefreshToken(userId: string): Promise<RefreshToken> {
  const sql = db()
  const refresh = newRefreshToken()
  await sql`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${refresh.hash}, ${refresh.expiresAt.toISOString()})
  `
  return refresh
}
