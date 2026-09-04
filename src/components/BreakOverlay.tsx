import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { FigureBadge } from './FigureBadge'
import { useContentStore } from '@/stores/content'
import { useSessionStore } from '@/stores/session'
import { KINDS } from '@/features/reminders/kinds'
import { stopAlerting } from '@/features/reminders/alert'
import { durationLabel } from '@/lib/format'

/**
 * The exercise you owe, put in front of whatever you were doing (§8.4).
 *
 * It is not a line on the home card saying one is due — a line is read and
 * ignored. It is the break itself, over the top, with the first movement
 * already on screen and the three answers under it. It comes up from any tab,
 * for a stand break, a mobility break or the eyes alike.
 *
 * It can be closed, and closing it buys quiet only until the app is next
 * brought to the foreground: the exercise stays owed, the card keeps saying so,
 * and the prompt returns. Nothing else is armed in the meantime. Pausing the
 * day holds it too, and resuming brings it back.
 */
export function BreakOverlay() {
  const awaiting = useSessionStore((s) => s.awaiting)
  const pause = useSessionStore((s) => s.pause)
  const dismissed = useSessionStore((s) => s.promptDismissed)
  const dismiss = useSessionStore((s) => s.dismissPrompt)
  const markDone = useSessionStore((s) => s.markDone)
  const snooze = useSessionStore((s) => s.snooze)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const meta = awaiting ? KINDS[awaiting.kind] : null
  const routine = useContentStore((s) => (meta ? s.routineBySlug(meta.routineSlug) : undefined))

  // Held work holds the prompt with it: being asked for a break during the
  // meeting you paused for is the opposite of the point. It comes back on
  // resume, with the exercise still owed.
  if (!awaiting || !meta || dismissed || pause) return null

  const first = routine?.steps[0]

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={meta.title}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)' }} />

      <div
        className="relative flex max-h-full w-full max-w-[380px] flex-col overflow-y-auto p-6"
        style={{ background: 'var(--surface)', borderRadius: 'var(--r-hero)' }}
      >
        <button
          type="button"
          aria-label="Fermer, sans répondre"
          onClick={() => {
            stopAlerting()
            dismiss()
          }}
          className="tap absolute right-3 top-3"
        >
          <X size={22} color="var(--text-2)" />
        </button>

        <h2 className="t-day pr-8">{meta.title}</h2>
        <p className="t-body mt-2" style={{ color: 'var(--text-2)' }}>
          {meta.why}
        </p>

        {first && routine && (
          <div className="mt-5 flex flex-col items-center text-center">
            <FigureBadge figureKey={first.figureKey} tone={routine.accent} size={170} animated />
            <h3 className="t-screen mt-4">{first.name}</h3>
            <p className="t-body mt-1.5 max-w-[30ch]" style={{ color: 'var(--text-2)' }}>
              {first.cue}
            </p>
            <p className="t-meta mt-2">{durationLabel(routine.durationS)} en tout</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            className="btn btn-accent btn-block"
            disabled={busy || !routine}
            onClick={() => navigate(`/player/${meta.routineSlug}?from=notification`)}
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
    </div>
  )
}
