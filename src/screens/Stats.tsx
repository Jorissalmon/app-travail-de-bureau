import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStatsStore } from '@/stores/stats'
import { LOW_ADHERENCE } from '@/features/session/stats'
import { percent, standsLine } from '@/lib/format'
import { weekdayInitial } from '@/lib/date'

/**
 * §11.5 — four honest numbers and nothing else. No calories, no "sitting time
 * avoided", no estimated health benefit: those are invented figures.
 */
export function Stats() {
  const stats = useStatsStore((s) => s.stats)
  const load = useStatsStore((s) => s.load)

  useEffect(() => {
    void load('week')
  }, [load])

  const byDay = stats?.standsByDay ?? []
  const maxStands = Math.max(1, ...byDay.map((d) => d.stands))
  const lowAdherence = stats?.adherence !== null && (stats?.adherence ?? 1) < LOW_ADHERENCE

  return (
    <div className="gutter pb-8">
      <h1 className="t-screen pt-5 pb-5">Suivi</h1>

      {/* Today */}
      <section className="rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
        <p className="t-card-eyebrow">Aujourd’hui</p>
        <p className="num mt-2" style={{ fontSize: 46, lineHeight: 1 }}>
          {stats?.standsToday ?? 0}
          <span className="text-[20px]" style={{ color: 'var(--text-2)' }}>
            {' '}
            / {stats?.remindersToday ?? 0}
          </span>
        </p>
        <p className="t-meta mt-1">{standsLine(stats?.standsToday ?? 0, stats?.remindersToday ?? 0)}</p>
      </section>

      {/* 7-day bars */}
      <section className="mt-4 rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
        <p className="t-card-eyebrow mb-4">7 derniers jours</p>
        <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
          {byDay.map((d, i) => {
            const isToday = i === byDay.length - 1
            const h = Math.max(6, (d.stands / maxStands) * 100)
            return (
              <div key={d.localDate} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[6px]"
                    style={{
                      height: `${h}%`,
                      background: isToday ? 'var(--accent)' : 'var(--surface-3)',
                    }}
                    aria-label={`${d.stands} levers`}
                  />
                </div>
                <span className="num text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {weekdayInitial(d.localDate)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Streak + adherence */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <section className="rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
          <p className="t-card-eyebrow">Série</p>
          <p className="num mt-2" style={{ fontSize: 34 }}>
            {stats?.streak ?? 0}
          </p>
          <p className="t-meta mt-1">jours avec au moins 3 levers</p>
        </section>
        <section className="rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
          <p className="t-card-eyebrow">Réponse aux rappels</p>
          <p className="num mt-2" style={{ fontSize: 34 }}>
            {percent(stats?.adherence ?? null)}
          </p>
          <p className="t-meta mt-1">sur 30 jours</p>
        </section>
      </div>

      {lowAdherence && (
        <p className="t-meta mt-4" style={{ color: 'var(--text-2)' }}>
          Tu réponds à moins de 40 % des rappels. Un intervalle plus long est peut-être plus juste
          pour toi — tu peux l’allonger dans les{' '}
          <Link to="/settings" className="underline underline-offset-4" style={{ color: 'var(--accent)' }}>
            réglages
          </Link>
          .
        </p>
      )}
    </div>
  )
}
