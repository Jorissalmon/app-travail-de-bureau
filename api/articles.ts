import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db'
import { ApiError, allowCors, fail, json, methods } from './_http'

/** Article list, or one article when ?slug= is given (§6). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (allowCors(req, res)) return
    methods(req, 'GET')
    const sql = db()
    const slug = typeof req.query.slug === 'string' ? req.query.slug : null

    if (slug) {
      const rows = await sql`SELECT * FROM articles WHERE slug = ${slug} LIMIT 1`
      const a = rows[0]
      if (!a) throw new ApiError(404, 'not_found', 'Article introuvable.')
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
      json(res, 200, mapArticle(a))
      return
    }

    const rows = await sql`SELECT * FROM articles ORDER BY sort_order, title`
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
    json(res, 200, rows.map(mapArticle))
  } catch (e) {
    fail(res, e)
  }
}

function mapArticle(a: Record<string, unknown>) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    dek: a.dek,
    bodyMd: a.body_md,
    tag: a.tag,
    evidence: a.evidence,
    readMin: Number(a.read_min),
    sourceLabel: a.source_label,
    sourceUrl: a.source_url,
    sortOrder: Number(a.sort_order),
  }
}
