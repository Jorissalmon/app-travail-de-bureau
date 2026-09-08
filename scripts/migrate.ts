/**
 * Applies every db/NNN_*.sql against DATABASE_URL, in numeric order, using the
 * Neon HTTP driver so it works where TCP 5432 is blocked.
 *
 *   pnpm db:migrate              # every migration
 *   pnpm db:migrate --seed-only  # only the content seed
 *
 * The list used to be hardcoded to 001 and 002, so a third file was written,
 * committed, and silently never applied. Reading the directory means adding a
 * migration is adding a file.
 *
 * A schema_migrations ledger records what has run, because 001_init.sql is not
 * re-runnable — its CREATE TABLE has no IF NOT EXISTS, so a second pass died on
 * the first statement and nothing after it was ever applied. On a database that
 * predates the ledger, 001 is marked applied when the users table is there.
 *
 * The content seed is the exception: it is a refresh, not a step, so it runs
 * every time.
 *
 * DATABASE_URL must point at the dedicated "releve" database (role releve_app).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { statements } from './sql-split.ts'

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error('DATABASE_URL is not set. See db/README.md.')
  process.exit(1)
}
if (/\/releve(\?|$)/.test(url) === false) {
  console.warn(
    '[warn] DATABASE_URL does not end in /releve — make sure it points at the dedicated database, not the other app.',
  )
}

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const sql = neon(url)
const seedOnly = process.argv.includes('--seed-only')

/** Split a SQL file into top-level statements, respecting $$-quoting and
    single quotes. Good enough for our hand-written migrations. */

async function run(file: string) {
  const text = readFileSync(resolve(root, 'db', file), 'utf8')
  const stmts = statements(text).filter((s) => !/^(BEGIN|COMMIT)$/i.test(s))
  console.log(`\n=== ${file} — ${stmts.length} statements ===`)
  for (const stmt of stmts) {
    const label = stmt.replace(/\s+/g, ' ').slice(0, 70)
    try {
      await sql.query(stmt)
      process.stdout.write('.')
    } catch (e) {
      console.error(`\nFailed on: ${label}\n`, e)
      throw e
    }
  }
  console.log(' done')
}

/** The seed is regenerated content, replayed on every run rather than recorded. */
const isSeed = (file: string) => file.includes('seed')

async function applied(): Promise<Set<string>> {
  await sql.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
  const rows = (await sql.query('SELECT filename FROM schema_migrations')) as { filename: string }[]
  const done = new Set(rows.map((r) => r.filename))
  if (done.size === 0) {
    // A database created before the ledger existed. The users table is proof
    // that 001 ran; without this, re-applying it would fail and take the whole
    // migration down with it.
    const [{ exists }] = (await sql.query(
      `SELECT to_regclass('public.users') IS NOT NULL AS exists`,
    )) as { exists: boolean }[]
    if (exists) {
      await sql.query(`INSERT INTO schema_migrations (filename) VALUES ('001_init.sql')
                       ON CONFLICT DO NOTHING`)
      done.add('001_init.sql')
      console.log('Base antérieure au registre : 001_init.sql marqué comme appliqué.')
    }
  }
  return done
}

const files = readdirSync(resolve(root, 'db'))
  .filter((f) => /^\d{3}_.*\.sql$/.test(f))
  .sort()

try {
  const done = await applied()
  for (const file of files) {
    if (seedOnly && !isSeed(file)) continue
    if (!isSeed(file) && done.has(file)) {
      console.log(`\n=== ${file} — déjà appliqué, ignoré ===`)
      continue
    }
    await run(file)
    if (!isSeed(file)) {
      await sql.query(`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`, [
        file,
      ])
    }
  }
  console.log('\nMigration complete.')
} catch {
  process.exit(1)
}
