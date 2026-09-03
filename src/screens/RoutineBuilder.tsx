import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Minus, Plus, Trash2, X } from 'lucide-react'
import { FigureBadge } from '@/components/FigureBadge'
import { Sheet } from '@/components/Sheet'
import { useContentStore } from '@/stores/content'
import { durationLabel, mmss } from '@/lib/format'
import { stepTone } from '@/lib/tones'
import {
  MAX_STEP_S,
  MIN_STEP_S,
  STEP_INCREMENT_S,
  addCustomStep,
  buildCatalogue,
  customRoutines,
  deleteCustomRoutine,
  moveCustomStep,
  removeCustomStep,
  renameCustomRoutine,
  setCustomStepDuration,
} from '@/features/routines/custom'

/**
 * Composing a routine out of the exercises the app already ships: pick them,
 * order them, set how long each one lasts.
 *
 * Only the choices are edited here. Nothing is written by hand — no exercise
 * names, no cues, no illustrations — so a routine built today keeps working
 * when the catalogue behind it is corrected, and every step still opens the
 * same explanation page as a shipped one.
 */
export function RoutineBuilder() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const routines = useContentStore((s) => s.routines)
  const mine = useContentStore((s) => s.mine)
  const refreshMine = useContentStore((s) => s.refreshMine)

  const routine = mine.find((r) => r.slug === slug)
  const stored = customRoutines().find((r) => r.slug === slug)

  const [title, setTitle] = useState(stored?.title ?? '')
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (stored) setTitle(stored.title)
  }, [stored])

  const catalogue = useMemo(() => buildCatalogue(routines), [routines])

  const change = useCallback(
    async (fn: () => Promise<void>) => {
      await fn()
      await refreshMine()
    },
    [refreshMine],
  )

  if (!slug || !routine || !stored) {
    return (
      <div className="gutter pt-6">
        <p className="t-meta">Cette routine n’existe plus.</p>
        <button type="button" className="btn btn-secondary mt-4" onClick={() => navigate('/library')}>
          Retour aux routines
        </button>
      </div>
    )
  }

  return (
    <div className="gutter pb-10">
      <div className="flex items-center justify-between pt-4 pb-2">
        <button type="button" aria-label="Retour" onClick={() => navigate('/library')} className="tap -ml-2">
          <ArrowLeft size={22} color="var(--text)" />
        </button>
        <button
          type="button"
          aria-label="Supprimer cette routine"
          onClick={() => setConfirmDelete(true)}
          className="tap -mr-2"
        >
          <Trash2 size={20} color="var(--danger)" />
        </button>
      </div>

      <label className="t-section mb-2 block" htmlFor="routine-title">
        Nom
      </label>
      <input
        id="routine-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void change(() => renameCustomRoutine(slug, title))}
        className="w-full rounded-[16px] px-4 py-3 text-[17px]"
        style={{ background: 'var(--surface)', color: 'var(--text)', fontWeight: 700 }}
        maxLength={40}
      />

      <p className="t-meta mt-3">
        {routine.steps.length === 0
          ? 'Aucun exercice pour l’instant.'
          : `${routine.steps.length} exercice${routine.steps.length > 1 ? 's' : ''} · ${durationLabel(routine.durationS)}`}
      </p>

      <ol className="mt-5 flex flex-col gap-2.5">
        {routine.steps.map((step, i) => (
          <li
            key={`${step.exerciseKey}-${i}`}
            className="flex items-center gap-3 rounded-[16px] p-3"
            style={{ background: 'var(--surface)' }}
          >
            <FigureBadge figureKey={step.figureKey} tone={stepTone(step.figureKey)} size={40} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px]" style={{ fontWeight: 700 }}>
                {step.name}
              </p>
              <div className="mt-1 flex items-center gap-1">
                <button
                  type="button"
                  className="tap rounded-full"
                  style={{ width: 30, height: 30, minWidth: 30, minHeight: 30, background: 'var(--surface-2)' }}
                  aria-label={`Raccourcir ${step.name}`}
                  disabled={step.durationS <= MIN_STEP_S}
                  onClick={() =>
                    void change(() => setCustomStepDuration(slug, i, step.durationS - STEP_INCREMENT_S))
                  }
                >
                  <Minus size={14} color="var(--text)" />
                </button>
                <span className="num text-center text-[13px]" style={{ width: 42, color: 'var(--text-2)' }}>
                  {mmss(step.durationS)}
                </span>
                <button
                  type="button"
                  className="tap rounded-full"
                  style={{ width: 30, height: 30, minWidth: 30, minHeight: 30, background: 'var(--surface-2)' }}
                  aria-label={`Allonger ${step.name}`}
                  disabled={step.durationS >= MAX_STEP_S}
                  onClick={() =>
                    void change(() => setCustomStepDuration(slug, i, step.durationS + STEP_INCREMENT_S))
                  }
                >
                  <Plus size={14} color="var(--text)" />
                </button>
              </div>
            </div>

            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                aria-label={`Monter ${step.name}`}
                className="tap"
                style={{ minHeight: 30 }}
                disabled={i === 0}
                onClick={() => void change(() => moveCustomStep(slug, i, -1))}
              >
                <ChevronUp size={18} color={i === 0 ? 'var(--text-3)' : 'var(--text)'} />
              </button>
              <button
                type="button"
                aria-label={`Descendre ${step.name}`}
                className="tap"
                style={{ minHeight: 30 }}
                disabled={i === routine.steps.length - 1}
                onClick={() => void change(() => moveCustomStep(slug, i, 1))}
              >
                <ChevronDown
                  size={18}
                  color={i === routine.steps.length - 1 ? 'var(--text-3)' : 'var(--text)'}
                />
              </button>
            </div>

            <button
              type="button"
              aria-label={`Retirer ${step.name}`}
              className="tap shrink-0"
              onClick={() => void change(() => removeCustomStep(slug, i))}
            >
              <X size={18} color="var(--text-2)" />
            </button>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="btn btn-secondary btn-block mt-4"
        onClick={() => setPicking(true)}
      >
        <Plus size={18} />
        Ajouter un exercice
      </button>

      {routine.steps.length > 0 && (
        <button
          type="button"
          className="btn btn-accent btn-block mt-3"
          onClick={() => navigate(`/player/${routine.slug}`)}
        >
          Commencer · {durationLabel(routine.durationS)}
        </button>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Ajouter un exercice">
        <ul className="flex flex-col gap-2">
          {catalogue.map((entry) => (
            <li key={entry.exerciseKey}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[16px] p-2.5 text-left"
                style={{ background: 'var(--surface-2)' }}
                onClick={() => {
                  void change(() => addCustomStep(slug, entry.exerciseKey, entry.durationS))
                  setPicking(false)
                }}
              >
                <FigureBadge figureKey={entry.figureKey} tone={stepTone(entry.figureKey)} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]" style={{ fontWeight: 700 }}>
                    {entry.name}
                  </span>
                  <span className="t-meta mt-0.5 line-clamp-1 block">{entry.cue}</span>
                </span>
                <span className="num shrink-0 text-[13px]" style={{ color: 'var(--text-2)' }}>
                  {mmss(entry.durationS)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer cette routine ?"
      >
        <p className="t-body" style={{ color: 'var(--text-2)' }}>
          Elle disparaîtra de tes routines. Les exercices qu’elle contient, eux, restent
          disponibles — ils viennent du catalogue de l’app.
        </p>
        <button
          type="button"
          className="btn btn-danger btn-block mt-5"
          onClick={() =>
            void change(() => deleteCustomRoutine(slug)).then(() => navigate('/library'))
          }
        >
          Supprimer
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block mt-2.5"
          onClick={() => setConfirmDelete(false)}
        >
          Annuler
        </button>
      </Sheet>
    </div>
  )
}
