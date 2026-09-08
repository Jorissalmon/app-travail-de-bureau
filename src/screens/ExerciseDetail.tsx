import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { FigureBadge } from '@/components/FigureBadge'
import { ExerciseSections } from '@/components/ExerciseSections'
import { useContentStore } from '@/stores/content'
import { stepTone } from '@/lib/tones'

/**
 * The full how-to behind one movement (§ audit — "les exos doivent avoir une
 * page où on explique ce que c'est"). Reached from a step in RoutineDetail;
 * the route carries the routine slug and step position rather than the
 * exercise key directly, so "back" returns to the exact routine the reader
 * came from, and the header can say which step of which routine this is.
 *
 * Written for someone who has never done any of this: every section answers
 * one question in order — how, what helps, what to do if it's hard, what it
 * works, when to stop.
 */
export function ExerciseDetail() {
  const { slug, position } = useParams()
  const navigate = useNavigate()
  const routine = useContentStore((s) => (slug ? s.routineBySlug(slug) : undefined))
  const exerciseByKey = useContentStore((s) => s.exerciseByKey)

  const step = routine?.steps.find((s) => s.position === Number(position))
  const exercise = step ? exerciseByKey(step.exerciseKey) : undefined

  if (!routine || !step || !exercise) {
    return (
      <div className="gutter pt-6">
        <p className="t-meta">Exercice introuvable.</p>
      </div>
    )
  }

  const tone = stepTone(step.figureKey)

  return (
    <div className="gutter pb-10">
      <div className="flex items-center justify-between pt-4 pb-2">
        <button type="button" aria-label="Retour" onClick={() => navigate(-1)} className="tap -ml-2">
          <ArrowLeft size={22} color="var(--text)" />
        </button>
        <p className="t-meta">{routine.title}</p>
        <span style={{ width: 22 }} aria-hidden="true" />
      </div>

      <div className="mt-2 flex flex-col items-center text-center">
        <FigureBadge figureKey={step.figureKey} tone={tone} size={140} animated />
        <h1 className="t-screen mt-5">{exercise.title}</h1>
        <p className="t-body mt-2 max-w-[34ch]" style={{ color: 'var(--text-2)' }}>
          {step.cue}
        </p>
      </div>

      <div className="mt-8">
        <ExerciseSections exercise={exercise} />
      </div>
    </div>
  )
}
