import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { allowCors, fail, json, methods } from './_http.js'

/**
 * The exercise library: one entry per distinct movement, the full how-to
 * behind a routine step's one-line cue (§ audit). Independent of /api/routines
 * on purpose — the same movement recurs across routines, and embedding its
 * full explanation in every step that uses it would repeat the same text up
 * to three times over the wire for nothing.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'GET')
    const sql = db()
    const rows = await sql`
      SELECT key, title, steps, tips, easier, muscles, avoid, articles, discreet
      FROM exercises ORDER BY key
    `
    const out = rows.map((r) => ({
      key: r.key,
      title: r.title,
      steps: r.steps,
      tips: r.tips,
      easier: r.easier,
      muscles: r.muscles,
      avoid: r.avoid,
      articles: r.articles,
      discreet: r.discreet,
    }))

    // Content changes rarely, same cache policy as /api/routines.
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
    json(res, 200, out)
  } catch (e) {
    fail(res, e)
  }
}
