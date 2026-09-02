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
  /** True while an exercise is on screen and the grid is stopped. */
  paused?: boolean
  /** Interval in seconds, to size the ring. */
  intervalS: number
  onStart: () => void
  onStop: () => void
  busy?: boolean
}

export function SessionCard({
  active,
  elapsedS,
  nextInS,
  intervalS,
  onStart,
  onStop,
  busy,
  paused = false,
}: SessionCardProps) {
  const progress = useMemo(() => {
    if (paused || nextInS === null || intervalS <= 0) return 0
    return 1 - Math.min(1, Math.max(0, nextInS / intervalS))
  }, [paused, nextInS, intervalS])

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
        <span className="t-count" style={{ fontSize: paused ? 34 : 54 }}>
          {paused ? 'En pause' : nextInS === null ? '—' : mmss(nextInS)}
        </span>
        <span className="t-meta mt-1">
          {paused ? 'le temps de l’exercice' : 'avant le prochain'}
        </span>
      </TimerRing>

      <button
        type="button"
        className="btn btn-danger btn-block mt-7"
        onClick={onStop}
        disabled={busy}
      >
        Terminer ma journée
      </button>
    </section>
  )
}
