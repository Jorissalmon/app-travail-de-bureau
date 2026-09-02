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
import {
  FINAL_COUNTDOWN_S,
  cueEnd,
  cueStep,
  cueTick,
  loadCues,
  primeCues,
} from '@/features/session/cues'
import { durationFor, loadDurations } from '@/features/session/durations'
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
  const [remaining, setRemaining] = useState(0)
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const startedAtRef = useRef<number>(Date.now())
  /** Wall-clock instant the current step ends. Null while paused. */
  const deadlineRef = useRef<number | null>(null)
  /** Last second already cued, so the 250 ms interval blips only once each. */
  const lastCuedRef = useRef<number | null>(null)

  const steps = useMemo(() => routine?.steps ?? [], [routine])
  const step = steps[stepIndex]
  const isLast = stepIndex >= steps.length - 1

  const tick = useCallback(() => {
    if (vibrate && isNative()) void Haptics.impact({ style: ImpactStyle.Light })
    cueStep()
  }, [vibrate])

  const goNext = useCallback(() => {
    if (isLast) {
      setFinished(true)
      return
    }
    setStepIndex((i) => i + 1)
    tick()
  }, [isLast, tick])

  // Keep the screen awake while playing (§11.3).
  useEffect(() => {
    if (!isNative()) return
    void KeepAwake.keepAwake()
    return () => {
      void KeepAwake.allowSleep()
    }
  }, [])

  // Reaching this screen is always a tap, which is the gesture the browser
  // wants before it will let an AudioContext make a sound. The durations are
  // loaded here too, before the first step is armed.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void Promise.all([loadCues().then(primeCues), loadDurations()]).then(() => setReady(true))
  }, [])

  // Arm the step: also covers the routine arriving after the first render.
  useEffect(() => {
    const s = steps[stepIndex]
    if (!s || !routine || !ready) return
    const seconds = durationFor(routine.slug, s.position, s.durationS)
    setRemaining(seconds)
    deadlineRef.current = Date.now() + seconds * 1000
    lastCuedRef.current = null
  }, [steps, stepIndex, routine, ready])

  // Held in a ref so a new goNext identity does not restart the interval and
  // reset its phase on every step.
  const goNextRef = useRef(goNext)
  useEffect(() => {
    goNextRef.current = goNext
  }, [goNext])

  // Countdown read from the wall clock, never by counting ticks: the WebView
  // throttles (and on Android may suspend) timers as soon as the app goes to
  // the background, which made steps run long. Reading a deadline means a
  // frozen interval self-corrects on the very next tick after resume.
  useEffect(() => {
    if (paused || finished || !step) return
    const t = setInterval(() => {
      const deadline = deadlineRef.current
      if (deadline === null) return
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(left)
      // Four ticks a second, so the cue is gated on the displayed second
      // actually changing.
      if (left !== lastCuedRef.current) {
        lastCuedRef.current = left
        if (left > 0 && left <= FINAL_COUNTDOWN_S) cueTick()
      }
      if (left === 0) goNextRef.current()
    }, 250)
    return () => clearInterval(t)
  }, [paused, finished, step])

  const togglePause = useCallback(() => {
    if (paused) {
      deadlineRef.current = Date.now() + remaining * 1000
      setPaused(false)
      return
    }
    const deadline = deadlineRef.current
    if (deadline !== null) setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    deadlineRef.current = null
    setPaused(true)
  }, [paused, remaining])

  // On finish: record completion + event.
  useEffect(() => {
    if (!finished || !routine) return
    cueEnd()
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
    if (!step || !routine) return 0
    const total = durationFor(routine.slug, step.position, step.durationS)
    return 1 - remaining / total
  }, [step, routine, remaining])

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
          <FigureBadge figureKey={step.figureKey} tone={routine.accent} size={200} animated />
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
          onClick={togglePause}
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
