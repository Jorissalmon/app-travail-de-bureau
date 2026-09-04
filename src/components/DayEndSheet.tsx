import { useState } from 'react'
import { X } from 'lucide-react'
import { useSessionStore } from '@/stores/session'
import { hhmmOf, resolveEnd } from '@/features/session/dayend'
import { dayName } from '@/lib/date'

/**
 * The question a forgotten day leaves behind: « tu as fini vers quelle heure ? »
 *
 * Nothing used to end a session but the button, so one forgotten on a Friday
 * evening ran all weekend and every number computed from it was fiction. The
 * app now closes a day at its own boundary — the start of the quiet window, or
 * the end of the day itself — but a session that survived into another day is
 * a different case: the boundary is only the app's best guess, and the whole
 * worth of the tracking screen is that nothing on it is guessed. So it asks,
 * with its guess already in the box, and takes whatever answer it is given.
 *
 * Closing it without answering buys quiet until the next foreground, exactly
 * like the break prompt. The day stays unclosed until it is settled.
 */
export function DayEndSheet() {
  const pending = useSessionStore((s) => s.pendingClose)
  const dismissed = useSessionStore((s) => s.closeDismissed)
  const dismiss = useSessionStore((s) => s.dismissClosePrompt)
  const confirmClose = useSessionStore((s) => s.confirmClose)

  const suggested = pending ? new Date(pending.suggestedEnd) : null
  const [value, setValue] = useState<string>('')
  const [busy, setBusy] = useState(false)

  if (!pending || !suggested || dismissed) return null

  const startedAt = new Date(pending.startedAt)
  const hhmm = value || hhmmOf(suggested)

  async function settle(at: Date) {
    setBusy(true)
    try {
      await confirmClose(at)
      setValue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Fin de la journée précédente"
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)' }} />

      <div
        className="relative flex max-h-full w-full max-w-[380px] flex-col overflow-y-auto p-6"
        style={{ background: 'var(--surface)', borderRadius: 'var(--r-hero)' }}
      >
        <button
          type="button"
          aria-label="Fermer, sans répondre"
          onClick={dismiss}
          className="tap absolute top-3 right-3"
        >
          <X size={22} color="var(--text-2)" />
        </button>

        <h2 className="t-screen pr-8">Ta journée de {dayName(startedAt)} est restée ouverte.</h2>
        <p className="t-body mt-2" style={{ color: 'var(--text-2)' }}>
          Elle a démarré à {hhmmOf(startedAt)} et personne ne l’a terminée. Plutôt que d’inventer
          une heure de fin — et de compter une assise que tu n’as pas faite — dis-moi vers quelle
          heure tu t’es arrêté.
        </p>

        <label className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[16px]">Fini vers</span>
          <input
            type="time"
            value={hhmm}
            aria-label="Heure de fin"
            onChange={(e) => setValue(e.target.value)}
            className="rounded-[10px] px-3 py-2 text-[15px]"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          />
        </label>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            className="btn btn-accent btn-block"
            disabled={busy}
            onClick={() => {
              const at = resolveEnd(hhmm, startedAt, suggested)
              if (at) void settle(at)
            }}
          >
            Enregistrer
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy}
            onClick={() => void settle(suggested)}
          >
            Je ne sais plus — prends {hhmmOf(suggested)}
          </button>
        </div>
      </div>
    </div>
  )
}
