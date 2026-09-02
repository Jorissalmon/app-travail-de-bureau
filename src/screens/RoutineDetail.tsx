import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Minus, Plus } from 'lucide-react'
import { FigureBadge } from '@/components/FigureBadge'
import { useContentStore } from '@/stores/content'
import { durationLabel, mmss } from '@/lib/format'
import { ZONE_LABEL } from '@/content'
import { stepTone } from '@/lib/tones'
import {
  DURATION_STEP_S,
  MAX_DURATION_S,
  MIN_DURATION_S,
  durationFor,
  isCustomised,
  loadDurations,
  resetRoutine,
  setDuration,
  totalFor,
} from '@/features/session/durations'

/** §11.2 — routine detail: title, duration, summary, steps, Commencer. */
export function RoutineDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const routine = useContentStore((s) => (slug ? s.routineBySlug(slug) : undefined))

  // Bumped on every override change: the durations live in a module, not in
  // state, so the render needs telling that they moved.
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    void loadDurations().then(() => setRevision((n) => n + 1))
  }, [])

  const bump = useCallback(
    async (position: number, current: number, delta: number) => {
      if (!slug) return
      await setDuration(slug, position, current + delta)
      setRevision((n) => n + 1)
    },
    [slug],
  )

  if (!routine) {
    return (
      <div className="gutter pt-6">
        <p className="t-meta">Routine introuvable.</p>
      </div>
    )
  }

  const total = totalFor(routine.slug, routine.steps)
  const customised = isCustomised(routine.slug)

  return (
    <div className="gutter pb-10" data-revision={revision}>
      <div className="flex items-center pt-4 pb-2">
        <button type="button" aria-label="Retour" onClick={() => navigate(-1)} className="tap -ml-2">
          <ArrowLeft size={22} color="var(--text)" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <FigureBadge
          figureKey={routine.steps[0]?.figureKey ?? 'marche'}
          tone={routine.accent}
          size={72}
          animated
        />
        <div>
          <h1 className="t-screen">{routine.title}</h1>
          <p className="t-meta mt-1">
            {ZONE_LABEL[routine.zone]} · {durationLabel(total)}
          </p>
        </div>
      </div>

      <p className="t-body mt-4" style={{ color: 'var(--text-2)' }}>
        {routine.summary}
      </p>

      <ol className="mt-6 flex flex-col gap-2.5">
        {routine.steps.map((step) => {
          const seconds = durationFor(routine.slug, step.position, step.durationS)
          return (
            <li
              key={step.position}
              className="flex items-center gap-3 rounded-[16px] p-3"
              style={{ background: 'var(--surface)' }}
            >
              <FigureBadge figureKey={step.figureKey} tone={stepTone(step.figureKey)} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px]" style={{ fontWeight: 700 }}>
                  {step.name}
                </p>
                <p className="t-meta mt-0.5 line-clamp-1">{step.cue}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="tap rounded-full"
                  style={{ width: 34, height: 34, minWidth: 34, minHeight: 34, background: 'var(--surface-2)' }}
                  aria-label={`Raccourcir ${step.name}`}
                  disabled={seconds <= MIN_DURATION_S}
                  onClick={() => void bump(step.position, seconds, -DURATION_STEP_S)}
                >
                  <Minus size={16} color="var(--text)" />
                </button>
                <span
                  className="num text-center text-[14px]"
                  style={{ width: 44, color: 'var(--text-2)' }}
                  aria-label={`${seconds} secondes`}
                >
                  {mmss(seconds)}
                </span>
                <button
                  type="button"
                  className="tap rounded-full"
                  style={{ width: 34, height: 34, minWidth: 34, minHeight: 34, background: 'var(--surface-2)' }}
                  aria-label={`Allonger ${step.name}`}
                  disabled={seconds >= MAX_DURATION_S}
                  onClick={() => void bump(step.position, seconds, DURATION_STEP_S)}
                >
                  <Plus size={16} color="var(--text)" />
                </button>
              </div>
            </li>
          )
        })}
      </ol>

      {customised && (
        <button
          type="button"
          className="tap mx-auto mt-4 block"
          onClick={() => void resetRoutine(routine.slug).then(() => setRevision((n) => n + 1))}
        >
          <span className="t-meta underline underline-offset-4">Rétablir les durées d’origine</span>
        </button>
      )}

      <button
        type="button"
        className="btn btn-accent btn-block mt-7"
        onClick={() => navigate(`/player/${routine.slug}`)}
      >
        Commencer · {durationLabel(total)}
      </button>
    </div>
  )
}
