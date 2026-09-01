import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db'
import { allowCors, fail, json, methods } from './_http'

/** All routines with their steps, ordered (§6). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'GET')
    const sql = db()
    const routines = await sql`
      SELECT id, slug, title, zone, duration_s, summary, accent, sort_order
      FROM routines ORDER BY sort_order, title
    `
    const steps = await sql`
      SELECT routine_id, position, name, duration_s, cue, figure_key
      FROM routine_steps ORDER BY routine_id, position
    `
    const byRoutine = new Map<string, unknown[]>()
    for (const s of steps) {
      const list = byRoutine.get(s.routine_id as string) ?? []
      list.push({
        position: Number(s.position),
        name: s.name,
        durationS: Number(s.duration_s),
        cue: s.cue,
        figureKey: s.figure_key,
      })
      byRoutine.set(s.routine_id as string, list)
    }

    const out = routines.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      zone: r.zone,
      durationS: Number(r.duration_s),
      summary: r.summary,
      accent: r.accent,
      sortOrder: Number(r.sort_order),
      steps: byRoutine.get(r.id as string) ?? [],
    }))

    // Content changes rarely and OTA handles the app shell; a short CDN cache
    // keeps the library snappy without going stale for long.
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
    json(res, 200, out)
  } catch (e) {
    fail(res, e)
  }
}
