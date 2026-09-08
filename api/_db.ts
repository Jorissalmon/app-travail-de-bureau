import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

/**
 * Neon client. All SQL is hand-written with parameterised queries — no ORM,
 * and never any string concatenation into a query (§3). The tagged-template
 * form `sql\`... ${value} ...\`` sends `value` as a bound parameter.
 */

let client: NeonQueryFunction<false, false> | null = null

export function db(): NeonQueryFunction<false, false> {
  if (client) return client
  // Trimmed: a stray space or tab around the value in the dashboard makes
  // neon() reject the string as an invalid URL, and every function 500s.
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL is not configured')
  client = neon(url)
  return client
}

/** Row shape helpers so call sites get typed results without an ORM. */
export type Row = Record<string, unknown>
