import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { FigureBadge } from '@/components/FigureBadge'
import { useContentStore } from '@/stores/content'
import { durationLabel } from '@/lib/format'
import { ZONE_LABEL } from '@/content'

/** §11.2 — routine detail: title, duration, summary, numbered steps, Commencer. */
export function RoutineDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const routine = useContentStore((s) => (slug ? s.routineBySlug(slug) : undefined))

  if (!routine) {
    return (
      <div className="gutter pt-6">
        <p className="t-meta">Routine introuvable.</p>
      </div>
    )
  }

  return (
    <div className="gutter pb-10">
      <div className="flex items-center pt-4 pb-2">
        <button type="button" aria-label="Retour" onClick={() => navigate(-1)} className="tap -ml-2">
          <ArrowLeft size={22} color="var(--text)" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <FigureBadge figureKey={routine.steps[0]?.figureKey ?? 'marche'} tone={routine.accent} size={72} />
        <div>
          <h1 className="t-screen">{routine.title}</h1>
          <p className="t-meta mt-1">
            {ZONE_LABEL[routine.zone]} · {durationLabel(routine.durationS)}
          </p>
        </div>
      </div>

      <p className="t-body mt-4" style={{ color: 'var(--text-2)' }}>
        {routine.summary}
      </p>

      <ol className="mt-6 flex flex-col gap-2.5">
        {routine.steps.map((step) => (
          <li
            key={step.position}
            className="flex items-center gap-3 rounded-[16px] p-3"
            style={{ background: 'var(--surface)' }}
          >
            <FigureBadge figureKey={step.figureKey} tone={routine.accent} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-700" style={{ fontWeight: 700 }}>
                {step.name}
              </p>
              <p className="t-meta mt-0.5 line-clamp-1">{step.cue}</p>
            </div>
            <span className="num shrink-0 text-[14px]" style={{ color: 'var(--text-2)' }}>
              {step.durationS}s
            </span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="btn btn-accent btn-block mt-7"
        onClick={() => navigate(`/player/${routine.slug}`)}
      >
        Commencer
      </button>
    </div>
  )
}
