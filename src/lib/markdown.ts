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
