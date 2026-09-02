import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { FigureBadge } from '@/components/FigureBadge'
import { useContentStore } from '@/stores/content'
import { useSessionStore } from '@/stores/session'
import { KINDS, isReminderKind } from '@/features/reminders/kinds'
import { durationLabel } from '@/lib/format'

/**
 * Where a tap on a reminder lands (§8.4). Full screen and loud on purpose: the
 * point is that the first thing to do is readable and already moving, without
 * a second tap. The three notification actions are repeated here, because the
 * notification may well have been swiped away before it was read.
 */
export function Alert() {
  const { kind } = useParams()
  const navigate = useNavigate()
  const markDone = useSessionStore((s) => s.markDone)
  const snooze = useSessionStore((s) => s.snooze)
  const [busy, setBusy] = useState(false)

  const meta = isReminderKind(kind) ? KINDS[kind] : null
  const routine = useContentStore((s) => (meta ? s.routineBySlug(meta.routineSlug) : undefined))

  if (!isReminderKind(kind) || !meta) return <Navigate to="/" replace />

  const first = routine?.steps[0]
  const rest = routine?.steps.slice(1) ?? []

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
      navigate('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      // A fixed height, not flex-1: #root only sets min-height, so a long
      // routine grew the page and pushed the three actions off the bottom
      // instead of scrolling the list above them.
      className="flex min-h-0 flex-col"
      style={{
        height: '100dvh',
        background: 'var(--bg)',
        paddingTop: 'calc(env(safe-area-inset-top,0px) + 20px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)',
      }}
    >
      <div className="gutter min-h-0 flex-1 overflow-y-auto">
        <h1 className="t-day">{meta.title}</h1>
        <p className="t-body mt-2" style={{ color: 'var(--text-2)' }}>
          {meta.why}
        </p>

        {first && routine && (
          <div className="mt-6 flex flex-col items-center text-center">
            <FigureBadge
              figureKey={first.figureKey}
              tone={routine.accent}
              size={220}
              animated
            />
            <h2 className="t-screen mt-5">{first.name}</h2>
            <p
              className="t-body mt-2 max-w-[34ch]"
              style={{ color: 'var(--text-2)', fontSize: 17 }}
            >
              {first.cue}
            </p>
            <p className="num mt-3 text-[15px]" style={{ color: 'var(--text-2)' }}>
              {first.durationS} s
            </p>
          </div>
        )}

        {rest.length > 0 && routine && (
          <>
            <h3 className="t-section mt-7 mb-2">
              Puis, {durationLabel(routine.durationS).toLowerCase()} en tout
            </h3>
            <ol className="flex flex-col gap-2">
              {rest.map((step) => (
                <li
                  key={step.position}
                  className="flex items-center gap-3 rounded-[16px] p-2.5"
                  style={{ background: 'var(--surface)' }}
                >
                  <FigureBadge figureKey={step.figureKey} tone={routine.accent} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">{step.name}</p>
                    <p className="t-meta mt-0.5 line-clamp-1">{step.cue}</p>
                  </div>
                  <span className="num shrink-0 text-[13px]" style={{ color: 'var(--text-2)' }}>
                    {step.durationS}s
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div className="gutter mt-4 flex flex-col gap-2.5">
        <button
          type="button"
          className="btn btn-accent btn-block"
          disabled={busy || !routine}
          onClick={() => navigate(`/player/${meta.routineSlug}?from=notification`, { replace: true })}
        >
          Commencer
        </button>
        <div className="flex gap-2.5">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            disabled={busy}
            onClick={() => void act(() => snooze(new Date()))}
          >
            +10 min
          </button>
          <button
            type="button"
            className="btn btn-secondary flex-1"
            disabled={busy}
            onClick={() => void act(() => markDone(new Date()))}
          >
            Déjà fait
          </button>
        </div>
      </div>
    </div>
  )
}
