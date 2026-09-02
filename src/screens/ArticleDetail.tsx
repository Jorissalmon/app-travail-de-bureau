import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Browser } from '@capacitor/browser'
import { EvidencePill } from '@/components/EvidencePill'
import { FigureBadge } from '@/components/FigureBadge'
import { useContentStore } from '@/stores/content'
import { splitArticle } from '@/lib/markdown'
import { stepTone } from '@/lib/tones'
import { isNative } from '@/lib/platform'

/** §11.4 — article detail with sanitised markdown body and an external source link. */
export function ArticleDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const article = useContentStore((s) => (slug ? s.articleBySlug(slug) : undefined))

  const blocks = useMemo(() => (article ? splitArticle(article.bodyMd) : []), [article])

  if (!article) {
    return (
      <div className="gutter pt-6">
        <p className="t-meta">Article introuvable.</p>
      </div>
    )
  }

  async function openSource() {
    if (!article) return
    // Open in the system browser via @capacitor/browser (§11.4).
    if (isNative()) await Browser.open({ url: article.sourceUrl })
    else window.open(article.sourceUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <article className="gutter pb-12">
      <div className="flex items-center pt-4 pb-2">
        <button type="button" aria-label="Retour" onClick={() => navigate(-1)} className="tap -ml-2">
          <ArrowLeft size={22} color="var(--text)" />
        </button>
      </div>

      <div className="mb-3">
        <EvidencePill evidence={article.evidence} />
      </div>
      <h1 className="t-screen">{article.title}</h1>
      <p className="t-body mt-2" style={{ color: 'var(--text-2)' }}>
        {article.dek}
      </p>

      <div className="mt-6 flex flex-col gap-1">
        {blocks.map((block, i) =>
          block.kind === 'figure' ? (
            <figure key={i} className="my-3 flex flex-col items-center text-center">
              <FigureBadge
                figureKey={block.figureKey}
                tone={stepTone(block.figureKey)}
                size={168}
                animated
              />
              {block.caption && (
                <figcaption className="t-meta mt-3 max-w-[34ch]">{block.caption}</figcaption>
              )}
            </figure>
          ) : (
            <div
              key={i}
              className="prose-releve"
              // Sanitised in renderMarkdown.
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          ),
        )}
      </div>

      <footer className="mt-8 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <p className="t-meta mb-2">Source</p>
        <button
          type="button"
          onClick={() => void openSource()}
          className="flex items-center gap-2 text-left"
          style={{ color: 'var(--accent)' }}
        >
          <span className="text-[15px] underline underline-offset-4">{article.sourceLabel}</span>
          <ExternalLink size={16} aria-hidden="true" />
        </button>
      </footer>
    </article>
  )
}
