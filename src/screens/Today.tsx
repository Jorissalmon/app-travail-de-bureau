import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { SessionCard } from '@/components/SessionCard'
import { PlanCard } from '@/components/PlanCard'
import { PainHeatmap } from '@/components/PainHeatmap'
import { Segmented } from '@/components/Segmented'
import { SearchField } from '@/components/SearchField'
import { ZoneCard } from '@/components/ZoneCard'
import { PermissionsSheet } from '@/components/PermissionsSheet'
import { NextReminders } from '@/components/NextReminders'
import { DayCard } from '@/components/DayCard'
import { adviceFor } from '@/features/session/daypart'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useStatsStore } from '@/stores/stats'
import { useContentStore } from '@/stores/content'
import { usePlanStore } from '@/stores/plan'
import { FAMILIES, PAIN_ZONE_LABEL, ZONES } from '@/content'
import { PLAN_SLUG } from '@/features/plan/compose'
import { delta } from '@/features/plan/painStats'
import { freezesLeft } from '@/features/session/stats'
import { trackNow } from '@/features/analytics/events'
import { localDate } from '@/lib/date'
import { useNow } from '@/app/useNow'
import { dateEyebrow, dayName } from '@/lib/date'
import { pendingAfter } from '@/features/reminders/schedule'
import { PermissionsMissingError } from '@/features/reminders/permissions'
import { primeAlarm, stopAlerting } from '@/features/reminders/alert'
import { askForTabNotifications } from '@/features/reminders/webAlarm'
import { standsLine } from '@/lib/format'
import { contextualCopy } from '@/features/reminders/contextual'

/** §11.1 — Aujourd'hui. */
export function Today() {
  const navigate = useNavigate()
  const now = useNow(1000)

  const session = useSessionStore((s) => s.session)
  const occurrences = useSessionStore((s) => s.occurrences)
  const start = useSessionStore((s) => s.start)
  const stop = useSessionStore((s) => s.stop)
  const pause = useSessionStore((s) => s.pause)
  const awaiting = useSessionStore((s) => s.awaiting)
  const pauseWork = useSessionStore((s) => s.pauseWork)
  const resumeWork = useSessionStore((s) => s.resumeWork)

  const intervalMin = useSettingsStore((s) => s.settings.intervalMin)
  const mobilityTimes = useSettingsStore((s) => s.settings.mobilityTimes)
  const eyeReminders = useSettingsStore((s) => s.settings.eyeReminders)
  const weekdays = useSettingsStore((s) => s.settings.weekdays)
  const user = useAuthStore((s) => s.user)
  const stats = useStatsStore((s) => s.stats)
  const loadStats = useStatsStore((s) => s.load)
  const routines = useContentStore((s) => s.routines)
  const plan = usePlanStore((s) => s.plan)
  const entries = usePlanStore((s) => s.entries)
  const planDoneToday = usePlanStore((s) => s.doneToday)

  /** 7, 14 or 30 days of history. Local to the screen: it is a way of looking. */
  const [span, setSpan] = useState<7 | 14 | 30>(7)

  const [busy, setBusy] = useState(false)
  const [showReminders, setShowReminders] = useState(false)
  const [showPermissions, setShowPermissions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const announced = useRef<string | null>(null)
  useEffect(() => {
    if (!plan || plan.blocks.length === 0 || announced.current === plan.id) return
    announced.current = plan.id
    trackNow({
      name: 'plan_shown',
      goal: plan.goal,
      zones: plan.targetZones.length,
      strengthBlocks: plan.blocks.filter((b) => b.type === 'strength').length,
      durationS: plan.durationS,
    })
  }, [plan])

  const today = localDate(now)

  /** The zones with any history, in the order the plan cares about them. */
  const trackedZones = useMemo(() => {
    const ordered = [...(plan?.targetZones ?? [])]
    for (const e of entries) if (!ordered.includes(e.zone)) ordered.push(e.zone)
    return ordered
  }, [plan, entries])

  /**
   * « Nuque : 6 → 3 en 11 jours ». Only for the primary zone, only when there
   * are answers on two different days, and only ever as the two numbers given
   * and the days between them — no percentage, no rate of improvement.
   */
  const primaryDelta = useMemo(() => {
    // The primary zone first, because that is the one the session was built
    // for. But it is often the zone declared at first run and never rated
    // since, and going silent while another zone holds a fortnight of answers
    // hid the one thing the person came back to see. The line names its zone,
    // so falling back says nothing untrue.
    const ordered = plan?.primaryZone
      ? [plan.primaryZone, ...trackedZones.filter((z) => z !== plan.primaryZone)]
      : trackedZones
    for (const zone of ordered) {
      const d = delta(entries, zone, today, span)
      if (d !== null) return d
    }
    return null
  }, [plan, trackedZones, entries, today, span])

  const freezes = useMemo(
    () =>
      freezesLeft(stats?.standsByDay ?? [], today, { weekdays }),
    [stats, today, weekdays],
  )

  const active = session !== null
  const elapsedS = active ? Math.max(0, (now.getTime() - new Date(session.startedAt).getTime()) / 1000) : 0

  // Re-derived on every clock tick, so the card follows the day by itself.
  const advice = useMemo(
    () =>
      adviceFor({
        now,
        sessionActive: active,
        standsToday: stats?.standsToday ?? 0,
        available: routines.map((r) => r.slug),
      }),
    [now, active, stats, routines],
  )

  const nextInS = useMemo(() => {
    if (!active) return null
    const upcoming = pendingAfter(occurrences, now).sort((a, b) => a.at.getTime() - b.at.getTime())
    const next = upcoming[0]
    if (!next) return null
    return Math.max(0, (next.at.getTime() - now.getTime()) / 1000)
  }, [active, occurrences, now])

  async function handleStart() {
    setBusy(true)
    setError(null)
    // This tap is the only moment a browser will unlock audio or grant
    // notifications; half an hour later, at the reminder, it is far too late.
    primeAlarm()
    void askForTabNotifications()
    try {
      await start()
      setShowPermissions(false)
    } catch (e) {
      // Missing grants are not a failure to report, they are a thing to fix:
      // open the sheet that fixes them (§8.3). Anything else is shown inline —
      // never rethrown, or it would leave the button spinning on an unhandled
      // rejection instead of telling the user what to do next.
      if (e instanceof PermissionsMissingError) setShowPermissions(true)
      else setError('La session n’a pas pu démarrer. Réessaie.')
    } finally {
      setBusy(false)
    }
  }

  async function handleStop() {
    setBusy(true)
    setError(null)
    try {
      await stop({ via: 'button' })
      void loadStats()
    } catch {
      setError('La journée n’a pas pu s’arrêter. Réessaie.')
    } finally {
      setBusy(false)
    }
  }

  const initial = (user?.displayName ?? 'M').slice(0, 1).toUpperCase()

  return (
    <div className="gutter pb-8">
      {/* Header */}
      <header className="flex items-start justify-between pt-4 pb-5">
        <div>
          <p className="t-eyebrow-date">{dateEyebrow(now)}</p>
          <h1 className="t-day mt-0.5">{dayName(now)}</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ background: 'var(--surface-2)' }}
            aria-label={`Série de ${stats?.streak ?? 0} jours`}
          >
            <Flame size={16} color="var(--accent)" aria-hidden="true" />
            <span className="num text-[14px]" style={{ fontWeight: 500 }}>
              {stats?.streak ?? 0}
            </span>
          </span>
          <button
            type="button"
            aria-label="Ouvrir le profil"
            onClick={() => navigate('/settings')}
            className="tap rounded-full text-[16px] font-800"
            style={{ background: 'var(--surface-2)', width: 44, height: 44, fontWeight: 800 }}
          >
            {initial}
          </button>
        </div>
      </header>

      {/* The plan leads. The work-session card, which used to occupy the top
          half, has moved under it: the reminder grid is now the second thing
          the app does, not the first. */}
      {plan && (
        <PlanCard
          plan={plan}
          busy={busy}
          onStart={() => navigate(`/player/${PLAN_SLUG}`)}
        />
      )}

      {(primaryDelta !== null || trackedZones.length > 0) && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="t-section">Ce que tu as répondu</h2>
            <div className="w-[150px]">
              <Segmented
                ariaLabel="Fenêtre de l’historique"
                options={[7, 14, 30] as const}
                value={span}
                onChange={setSpan}
                format={(v) => `${v} j`}
              />
            </div>
          </div>

          {primaryDelta !== null ? (
            <p className="t-body mb-3">
              <span style={{ textTransform: 'capitalize' }}>
                {PAIN_ZONE_LABEL[primaryDelta.zone] ?? primaryDelta.zone}
              </span>
              {' : '}
              <span className="num">{Math.round(primaryDelta.from * 10) / 10}</span>
              {' → '}
              <span className="num">{Math.round(primaryDelta.to * 10) / 10}</span>
              {' en '}
              <span className="num">{primaryDelta.days}</span>
              {primaryDelta.days > 1 ? ' jours' : ' jour'}
            </p>
          ) : (
            <p className="t-meta mb-3">
              Deux réponses sur deux jours différents, et cette ligne dira ce qui a changé.
            </p>
          )}

          {trackedZones.length > 0 && (
            <PainHeatmap entries={entries} zones={trackedZones} today={today} days={span} />
          )}
        </section>
      )}

      <h2 className="t-section mt-7 mb-3">Ta journée</h2>
      <SessionCard
        active={active}
        elapsedS={elapsedS}
        nextInS={nextInS}
        pauseReason={pause?.reason ?? null}
        heldS={pause?.heldMs != null ? Math.round(pause.heldMs / 1000) : null}
        awaiting={awaiting !== null}
        intervalS={intervalMin * 60}
        onStart={handleStart}
        onStop={handleStop}
        onPause={() => void pauseWork()}
        onResume={() => void resumeWork()}
        onDoExercise={() => {
          if (!awaiting) return
          stopAlerting()
          navigate(
            `/player/${
              contextualCopy(awaiting.kind, now, { plan, planDoneToday }).routineSlug
            }?from=notification`,
          )
        }}
        busy={busy}
      />

      {error && (
        <p className="t-meta mt-3" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {/* A reminder can now open either the plan or the ordinary break, so what
          is armed and what it will open has to be readable somewhere. */}
      <button
        type="button"
        className="t-meta mt-3 underline underline-offset-4"
        style={{ color: 'var(--text-2)' }}
        onClick={() => setShowReminders(true)}
      >
        Voir les prochains rappels
      </button>

      {advice && <DayCard advice={advice} />}

      <div className="mt-5">
        <SearchField value="" onChange={(v) => navigate(`/library?q=${encodeURIComponent(v)}`)} />
      </div>

      <h2 className="t-section mt-7 mb-3">Routines libres</h2>
      {FAMILIES.map((f) => (
        <section key={f.family} className="mt-5">
          <h2 className="t-section mb-3">{f.label}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {ZONES.filter((z) => z.family === f.family).map((z) => (
              <ZoneCard
                key={z.zone}
                label={z.label}
                to={`/library?zone=${z.zone}`}
                figureKey={z.figureKey}
                tone={z.tone}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Counted, never commented on. The freeze line is here rather than on
          the streak chip because it is the one thing about a streak worth
          knowing before it breaks. */}
      <p className="t-meta mt-7">
        {standsLine(stats?.standsToday ?? 0, stats?.remindersToday ?? 0)}
      </p>
      <p className="t-meta mt-1">
        Série : {stats?.streak ?? 0} jour{(stats?.streak ?? 0) > 1 ? 's' : ''} · {freezes} jour
        {freezes > 1 ? 's' : ''} de battement restant{freezes > 1 ? 's' : ''} ce mois-ci
      </p>

      <NextReminders
        open={showReminders}
        onClose={() => setShowReminders(false)}
        occurrences={occurrences}
        mobilityTimes={mobilityTimes}
        eyeReminders={eyeReminders}
        now={now}
        plan={plan}
        planDoneToday={planDoneToday}
        sessionActive={active}
      />

      <PermissionsSheet
        open={showPermissions}
        onClose={() => setShowPermissions(false)}
        onAllGranted={() => void handleStart()}
      />
    </div>
  )
}
