import { Link } from 'react-router-dom'
import { EvidencePill } from '@/components/EvidencePill'
import { FigureBadge } from '@/components/FigureBadge'
import { useContentStore } from '@/stores/content'
import { firstFigure } from '@/lib/markdown'
import { stepTone } from '@/lib/tones'
import { plural } from '@/lib/format'

/** §11.4 — article list: title, dek, evidence pill, reading time. */
export function Articles() {
  const articles = useContentStore((s) => s.articles)

  return (
    <div className="gutter pb-8">
      <h1 className="t-screen pt-5 pb-4">Infos</h1>

      <div className="flex flex-col gap-3">
        {articles.map((a) => (
          <Link
            key={a.slug}
            to={`/articles/${a.slug}`}
            className="block rounded-[20px] p-4 transition-colors active:opacity-90"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex items-start gap-3.5">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <EvidencePill evidence={a.evidence} />
                  <span className="t-meta">
                    {a.readMin} {plural(a.readMin, 'min', 'min')} de lecture
                  </span>
                </div>
                <h2 className="text-[20px] leading-tight font-800" style={{ fontWeight: 800 }}>
                  {a.title}
                </h2>
                <p className="t-meta mt-1.5">{a.dek}</p>
              </div>
              {(() => {
                const figureKey = firstFigure(a.bodyMd)
                return figureKey ? (
                  <FigureBadge figureKey={figureKey} tone={stepTone(figureKey)} size={64} />
                ) : null
              })()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
