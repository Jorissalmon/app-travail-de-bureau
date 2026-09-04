import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Minus, Plus } from 'lucide-react'
import { FigureBadge } from '@/components/FigureBadge'
import { useContentStore } from '@/stores/content'
import { durationLabel, mmss } from '@/lib/format'
import { ZONE_LABEL } from '@/content'
import { stepTone } from '@/lib/tones'
import { isCustomSlug } from '@/features/routines/custom'
import { hiddenAtOffice, place } from '@/features/place/place'
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
  const rawRoutine = useContentStore((s) => s.routines.find((r) => r.slug === slug))
  const exerciseByKey = useContentStore((s) => s.exerciseByKey)

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

  // A routine of one's own already stores its own durations, edited in the
  // builder. Offering the steppers here too would give the same number two
  // homes, so this screen only reads them.
  const mine = isCustomSlug(routine.slug)
  const total = mine
    ? routine.steps.reduce((n, s) => n + s.durationS, 0)
    : totalFor(routine.slug, routine.steps)
  const customised = !mine && isCustomised(routine.slug)

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

      {/* Nothing disappears silently: if the office set is shorter, it says so
          and says why. */}
      {rawRoutine && hiddenAtOffice(rawRoutine, place(), exerciseByKey) > 0 && (
        <p
          className="t-meta mt-3 rounded-[14px] p-3"
          style={{ background: 'var(--surface)' }}
        >
          {hiddenAtOffice(rawRoutine, place(), exerciseByKey) === 1
            ? 'Un mouvement est masqué : il ne se fait pas en open space. Passe en « À la maison » dans les réglages pour le retrouver.'
            : `${hiddenAtOffice(rawRoutine, place(), exerciseByKey)} mouvements sont masqués : ils ne se font pas en open space. Passe en « À la maison » dans les réglages pour les retrouver.`}
        </p>
      )}

      <ol className="mt-6 flex flex-col gap-2.5">
        {routine.steps.map((step) => {
          const seconds = mine
            ? step.durationS
            : durationFor(routine.slug, step.position, step.durationS)
          return (
            <li
              key={step.position}
              className="flex items-center gap-3 rounded-[16px] p-3"
              style={{ background: 'var(--surface)' }}
            >
              <FigureBadge figureKey={step.figureKey} tone={stepTone(step.figureKey)} size={44} />
              {/* Not .tap: that class flex-centers a single icon child, which
                  squeezed this two-line text block instead of stacking it. */}
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => navigate(`/library/${routine.slug}/${step.position}`)}
                aria-label={`En savoir plus sur ${step.name}`}
              >
                <p className="truncate text-[16px]" style={{ fontWeight: 700 }}>
                  {step.name}
                </p>
                <p className="t-meta mt-0.5 line-clamp-1 underline underline-offset-2">
                  {step.cue}
                </p>
              </button>
              {mine ? (
                <span
                  className="num shrink-0 text-center text-[14px]"
                  style={{ width: 44, color: 'var(--text-2)' }}
                >
                  {mmss(seconds)}
                </span>
              ) : (
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
              )}
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

      {mine && (
        <button
          type="button"
          className="btn btn-secondary btn-block mt-5"
          onClick={() => navigate(`/library/${routine.slug}/composer`)}
        >
          Modifier cette routine
        </button>
      )}

      <button
        type="button"
        className="btn btn-accent btn-block mt-3"
        onClick={() => navigate(`/player/${routine.slug}`)}
      >
        Commencer · {durationLabel(total)}
      </button>
    </div>
  )
}
