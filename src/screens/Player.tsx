import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Pause, Play, SkipForward, X } from 'lucide-react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { FigureBadge } from '@/components/FigureBadge'
import { TimerRing } from '@/components/TimerRing'
import { useContentStore } from '@/stores/content'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { isNative } from '@/lib/platform'
import { mmss } from '@/lib/format'
import { localDate } from '@/lib/date'
import { uuid } from '@/lib/uuid'
import { logCompletion } from '@/features/reminders/events'
import type { Completion } from '@/lib/types'

/**
 * §11.3 — full-screen guided player, one step at a time. The single most
 * important screen after the home. It self-advances, keeps the screen awake,
 * and on finish writes a completion (and a 'done' event if it came from a
 * notification). No confetti, no exaggerated praise.
 */
export function Player() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fromNotification = params.get('from') === 'notification'

  const routine = useContentStore((s) => (slug ? s.routineBySlug(slug) : undefined))
  const vibrate = useSettingsStore((s) => s.settings.vibrate)
  const markDone = useSessionStore((s) => s.markDone)

  const [stepIndex, setStepIndex] = useState(0)
  const [remaining, setRemaining] = useState(routine?.steps[0]?.durationS ?? 0)
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const startedAtRef = useRef<number>(Date.now())

  const steps = useMemo(() => routine?.steps ?? [], [routine])
  const step = steps[stepIndex]
  const isLast = stepIndex >= steps.length - 1

  const tick = useCallback(() => {
    if (vibrate && isNative()) void Haptics.impact({ style: ImpactStyle.Light })
  }, [vibrate])

  const goNext = useCallback(() => {
    if (isLast) {
      setFinished(true)
      return
    }
    setStepIndex((i) => {
      const next = i + 1
      setRemaining(steps[next]?.durationS ?? 0)
      return next
    })
    tick()
  }, [isLast, steps, tick])

  // Keep the screen awake while playing (§11.3).
  useEffect(() => {
    if (!isNative()) return
    void KeepAwake.keepAwake()
    return () => {
      void KeepAwake.allowSleep()
    }
  }, [])

  // Countdown. When a step reaches zero, advance.
  useEffect(() => {
    if (paused || finished) return
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // Defer the state transition out of the setter.
          queueMicrotask(goNext)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [paused, finished, goNext, stepIndex])

  // On finish: record completion + event.
  useEffect(() => {
    if (!finished || !routine) return
    const durationS = Math.round((Date.now() - startedAtRef.current) / 1000)
    const completion: Completion = {
      clientId: uuid(),
      routineId: routine.id,
      routineSlug: routine.slug,
      completedAt: new Date().toISOString(),
      durationS,
      localDate: localDate(),
    }
    void logCompletion(completion)
    if (fromNotification) void markDone(new Date(startedAtRef.current))
  }, [finished, routine, fromNotification, markDone])

  const progress = useMemo(() => {
    if (!step) return 0
    return 1 - remaining / step.durationS
  }, [step, remaining])

  if (!routine || !step) {
    return (
      <FullScreen>
        <p className="t-meta">Routine introuvable.</p>
        <button type="button" className="btn btn-secondary mt-4" onClick={() => navigate('/')}>
          Retour
        </button>
      </FullScreen>
    )
  }

  if (finished) {
    const durationS = Math.round((Date.now() - startedAtRef.current) / 1000)
    return (
      <FullScreen>
        <h1 className="t-day">Terminé.</h1>
        <p className="t-meta mt-2">{mmss(durationS)} de mouvement.</p>
        <button
          type="button"
          className="btn btn-accent btn-block mt-8"
          style={{ maxWidth: 320 }}
          onClick={() => navigate('/', { replace: true })}
        >
          Retour
        </button>
      </FullScreen>
    )
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      style={{
        background: 'var(--bg)',
        paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)',
      }}
    >
      {/* Step progress ticks (§11.3). */}
      <div className="gutter flex items-center gap-1.5">
        {steps.map((s, i) => (
          <span
            key={s.position}
            className="h-1 flex-1 rounded-full"
            style={{ background: i <= stepIndex ? 'var(--accent)' : 'var(--surface-2)' }}
          />
        ))}
        <button
          type="button"
          aria-label="Quitter la routine"
          onClick={() => navigate('/', { replace: true })}
          className="tap ml-1 -mr-2"
        >
          <X size={22} color="var(--text-2)" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gutter">
        <TimerRing progress={progress} size={260} stroke={6}>
          <FigureBadge figureKey={step.figureKey} tone={routine.accent} size={200} />
        </TimerRing>

        <p className="num mt-6" style={{ fontSize: 72, lineHeight: 1 }}>
          {mmss(remaining)}
        </p>

        <h2 className="t-screen mt-6 text-center">{step.name}</h2>
        <p className="t-body mt-2 max-w-[32ch] text-center" style={{ color: 'var(--text-2)', fontSize: 17 }}>
          {step.cue}
        </p>
      </div>

      <div className="gutter flex items-center gap-3">
        <button
          type="button"
          className="btn btn-secondary flex-1"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Reprendre' : 'Mettre en pause'}
        >
          {paused ? <Play size={20} /> : <Pause size={20} />}
          {paused ? 'Reprendre' : 'Pause'}
        </button>
        <button type="button" className="btn btn-accent flex-1" onClick={goNext} aria-label="Étape suivante">
          <SkipForward size={20} />
          {isLast ? 'Terminer' : 'Suivant'}
        </button>
      </div>
    </div>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="gutter flex min-h-0 flex-1 flex-col items-center justify-center text-center"
      style={{ background: 'var(--bg)' }}
    >
      {children}
    </div>
  )
}
