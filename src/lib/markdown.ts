import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Render article markdown to sanitised HTML (§11.4). marked + DOMPurify — no
 * raw HTML from the source is trusted.
 */
marked.setOptions({ gfm: true, breaks: false })

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

/**
 * Articles can place one of the app's own figures in the flow of the text, with
 * a line of its own:
 *
 *   ::figure omoplates | Le serrage d'omoplates, vu de dos.
 *
 * A marker rather than an image keeps the illustrations as the same drawings
 * the routines use — nothing to load, nothing to store, and they follow the
 * theme. The body stays plain markdown, so no database column is needed.
 */

export interface FigureBlock {
  kind: 'figure'
  figureKey: string
  caption: string
}

export interface HtmlBlock {
  kind: 'html'
  html: string
}

export type ArticleBlock = HtmlBlock | FigureBlock

const FIGURE_LINE = /^::figure[ \t]+([a-z0-9-]+)[ \t]*(?:\|[ \t]*(.*))?$/gm

export function splitArticle(md: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = []
  let cursor = 0

  // A fresh lastIndex each call: the regex is module-level and /g is stateful.
  FIGURE_LINE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FIGURE_LINE.exec(md)) !== null) {
    const before = md.slice(cursor, match.index)
    if (before.trim()) blocks.push({ kind: 'html', html: renderMarkdown(before) })
    blocks.push({ kind: 'figure', figureKey: match[1]!, caption: (match[2] ?? '').trim() })
    cursor = match.index + match[0].length
  }

  const rest = md.slice(cursor)
  if (rest.trim()) blocks.push({ kind: 'html', html: renderMarkdown(rest) })
  return blocks
}

/**
 * Every figure key an article places, in order. Free of the markdown renderer,
 * so the content test can validate the keys without needing a DOM.
 */
export function articleFigures(md: string): string[] {
  FIGURE_LINE.lastIndex = 0
  const keys: string[] = []
  let match: RegExpExecArray | null
  while ((match = FIGURE_LINE.exec(md)) !== null) keys.push(match[1]!)
  return keys
}

/** The figure an article leads with, used as its thumbnail in the list. */
export function firstFigure(md: string): string | null {
  return articleFigures(md)[0] ?? null
}
