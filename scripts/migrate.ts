/**
 * Applies db/001_init.sql then db/002_seed_content.sql against DATABASE_URL,
 * using the Neon HTTP driver so it works where TCP 5432 is blocked.
 *
 *   pnpm db:migrate              # 001 then 002
 *   pnpm db:migrate --seed-only  # only 002
 *
 * DATABASE_URL must point at the dedicated "releve" database (role releve_app).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
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
function statements(text: string): string[] {
  const out: string[] = []
  let buf = ''
  let inSingle = false
  let inDollar = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next2 = text.slice(i, i + 2)
    if (!inSingle && next2 === '$$') {
      inDollar = !inDollar
      buf += next2
      i++
      continue
    }
    if (!inDollar && ch === "'") {
      if (inSingle && text[i + 1] === "'") {
        buf += "''"
        i++
        continue
      }
      inSingle = !inSingle
    }
    if (ch === ';' && !inSingle && !inDollar) {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

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

try {
  if (!seedOnly) await run('001_init.sql')
  await run('002_seed_content.sql')
  console.log('\nMigration complete.')
} catch {
  process.exit(1)
}
