import { useMemo } from 'react'
import { FlowerGrid } from './FlowerGrid'
import { TimerRing } from './TimerRing'
import { elapsedLabel, mmss } from '@/lib/format'

/**
 * The home hero (§10.4 / §11.1). Two states: inactive ("Commencer ma journée")
 * and active (elapsed session time + countdown to the next reminder + Stop).
 * Occupies about half the screen.
 */
export interface SessionCardProps {
  active: boolean
  /** Seconds since the session started. */
  elapsedS: number
  /** Seconds until the next scheduled reminder, or null if none pending. */
  nextInS: number | null
  /** Why the clock is stopped, or null while it runs. */
  pauseReason?: 'manual' | 'break' | null
  /** True while a reminder that fired is still waiting to be answered. */
  awaiting?: boolean
  /** Interval in seconds, to size the ring. */
  intervalS: number
  onStart: () => void
  onStop: () => void
  onPause: () => void
  onResume: () => void
  busy?: boolean
}

export function SessionCard({
  active,
  elapsedS,
  nextInS,
  intervalS,
  onStart,
  onStop,
  onPause,
  onResume,
  busy,
  pauseReason = null,
  awaiting = false,
}: SessionCardProps) {
  const paused = pauseReason !== null
  const progress = useMemo(() => {
    if (paused || awaiting || nextInS === null || intervalS <= 0) return 0
    return 1 - Math.min(1, Math.max(0, nextInS / intervalS))
  }, [paused, awaiting, nextInS, intervalS])

  // The ring says one thing at a time, in the order that matters: an exercise
  // owed outranks a pause, and both outrank the countdown.
  const [count, caption] = awaiting
    ? ['À faire', 'un exercice t’attend']
    : pauseReason === 'manual'
      ? ['En pause', 'reprends quand tu es revenu']
      : pauseReason === 'break'
        ? ['En pause', 'le temps de l’exercice']
        : [nextInS === null ? '—' : mmss(nextInS), 'avant le prochain']

  if (!active) {
    return (
      <section
        className="relative overflow-hidden"
        style={{ background: 'var(--surface)', borderRadius: 'var(--r-hero)' }}
        aria-label="Session de travail"
      >
        <div className="absolute inset-0 flex items-start justify-center pt-6 opacity-90">
          <FlowerGrid badge={40} className="w-[86%]" />
        </div>
        <div
          className="relative flex flex-col justify-end p-6"
          style={{ minHeight: '44vh', background: 'linear-gradient(to top, var(--surface) 40%, transparent)' }}
        >
          <p className="t-card-eyebrow">Prêt</p>
          <h2 className="t-hero mt-1 mb-5">Commencer ma journée</h2>
          <button type="button" className="btn btn-accent btn-block" onClick={onStart} disabled={busy}>
            {busy ? 'Un instant…' : 'Commencer'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      className="relative flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--surface)', borderRadius: 'var(--r-hero)', minHeight: '44vh' }}
      aria-label="Session en cours"
    >
      <p className="t-card-eyebrow mb-4 text-center">En session depuis {elapsedLabel(elapsedS)}</p>

      <TimerRing progress={progress} size={220} stroke={6}>
        <span className="t-count" style={{ fontSize: paused || awaiting ? 34 : 54 }}>
          {count}
        </span>
        <span className="t-meta mt-1">{caption}</span>
      </TimerRing>

      <div className="mt-7 flex w-full gap-2.5">
        <button
          type="button"
          className="btn btn-secondary flex-1"
          onClick={pauseReason === 'manual' ? onResume : onPause}
          // Only the user's own pause is theirs to lift here; the one an
          // exercise puts on the clock ends when the exercise does.
          disabled={busy || pauseReason === 'break'}
        >
          {pauseReason === 'manual' ? 'Reprendre' : 'Pause'}
        </button>
        <button type="button" className="btn btn-danger flex-1" onClick={onStop} disabled={busy}>
          Terminer
        </button>
      </div>
    </section>
  )
}
