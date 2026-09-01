import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { SessionCard } from '@/components/SessionCard'
import { SearchField } from '@/components/SearchField'
import { ZoneCard } from '@/components/ZoneCard'
import { BatteryNotice } from '@/components/BatteryNotice'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useStatsStore } from '@/stores/stats'
import { ZONES } from '@/content'
import { useNow } from '@/app/useNow'
import { dateEyebrow, dayName } from '@/lib/date'
import { pendingAfter } from '@/features/reminders/schedule'
import { standsLine } from '@/lib/format'

/** §11.1 — Aujourd'hui. */
export function Today() {
  const navigate = useNavigate()
  const now = useNow(1000)

  const session = useSessionStore((s) => s.session)
  const occurrences = useSessionStore((s) => s.occurrences)
  const start = useSessionStore((s) => s.start)
  const stop = useSessionStore((s) => s.stop)

  const intervalMin = useSettingsStore((s) => s.settings.intervalMin)
  const user = useAuthStore((s) => s.user)
  const stats = useStatsStore((s) => s.stats)
  const loadStats = useStatsStore((s) => s.load)

  const [busy, setBusy] = useState(false)
  const [showBattery, setShowBattery] = useState(false)

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const active = session !== null
  const elapsedS = active ? Math.max(0, (now.getTime() - new Date(session.startedAt).getTime()) / 1000) : 0

  const nextInS = useMemo(() => {
    if (!active) return null
    const upcoming = pendingAfter(occurrences, now).sort((a, b) => a.at.getTime() - b.at.getTime())
    const next = upcoming[0]
    if (!next) return null
    return Math.max(0, (next.at.getTime() - now.getTime()) / 1000)
  }, [active, occurrences, now])

  async function handleStart() {
    setBusy(true)
    try {
      await start()
      // Show the battery-optimisation notice once, right after the first start (§8.3).
      setShowBattery(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleStop() {
    setBusy(true)
    try {
      await stop({ via: 'button' })
      void loadStats()
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

      <SessionCard
        active={active}
        elapsedS={elapsedS}
        nextInS={nextInS}
        intervalS={intervalMin * 60}
        onStart={handleStart}
        onStop={handleStop}
        busy={busy}
      />

      <div className="mt-5">
        <SearchField value="" onChange={(v) => navigate(`/library?q=${encodeURIComponent(v)}`)} />
      </div>

      <section className="mt-7">
        <h2 className="t-section mb-3">Parcourir par zone</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {ZONES.map((z) => (
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

      <p className="t-meta mt-7">
        {standsLine(stats?.standsToday ?? 0, stats?.remindersToday ?? 0)}
      </p>

      <BatteryNotice open={showBattery} onClose={() => setShowBattery(false)} />
    </div>
  )
}
