import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Segmented } from '@/components/Segmented'
import { useStatsStore } from '@/stores/stats'
import { LOW_ADHERENCE } from '@/features/session/stats'
import { minutesLabel, percent, plural, standsLine } from '@/lib/format'
import { weekdayInitial } from '@/lib/date'

/**
 * §11.5 — honest numbers and nothing else. No calories, no "sitting time
 * avoided", no estimated health benefit: those would be invented figures.
 * Everything here is either counted or a share of things counted.
 */

const RANGES = ['week', 'month'] as const
type Range = (typeof RANGES)[number]

export function Stats() {
  const stats = useStatsStore((s) => s.stats)
  const range = useStatsStore((s) => s.range)
  const load = useStatsStore((s) => s.load)

  useEffect(() => {
    void load('week')
  }, [load])

  // Memoised: the `?? []` would otherwise be a new array on every render, and
  // the summary below depends on it.
  const byDay = useMemo(() => stats?.standsByDay ?? [], [stats])
  const maxStands = Math.max(1, ...byDay.map((d) => d.stands))
  const lowAdherence = stats?.adherence !== null && (stats?.adherence ?? 1) < LOW_ADHERENCE

  const summary = useMemo(() => {
    const total = byDay.reduce((n, d) => n + d.stands, 0)
    const active = byDay.filter((d) => d.stands > 0).length
    const best = byDay.reduce<{ localDate: string; stands: number } | null>(
      (acc, d) => (acc === null || d.stands > acc.stands ? d : acc),
      null,
    )
    return { total, active, best }
  }, [byDay])

  // A month of bars cannot carry a label each; one in five keeps it readable.
  const labelEvery = byDay.length > 10 ? 5 : 1

  return (
    <div className="gutter pb-8">
      <h1 className="t-screen pt-5 pb-4">Suivi</h1>

      <Segmented<Range>
        options={RANGES}
        value={range}
        onChange={(r) => void load(r)}
        format={(r) => (r === 'week' ? '7 jours' : '30 jours')}
        ariaLabel="Période"
      />

      {/* Today */}
      <section className="mt-4 rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
        <p className="t-card-eyebrow">Aujourd’hui</p>
        <p className="num mt-2" style={{ fontSize: 46, lineHeight: 1 }}>
          {stats?.standsToday ?? 0}
          <span className="text-[20px]" style={{ color: 'var(--text-2)' }}>
            {' '}
            / {stats?.remindersToday ?? 0}
          </span>
        </p>
        <p className="t-meta mt-1">
          {standsLine(stats?.standsToday ?? 0, stats?.remindersToday ?? 0)}
        </p>
      </section>

      {/* Bars over the range */}
      <section className="mt-4 rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
        <p className="t-card-eyebrow mb-4">
          {range === 'week' ? '7 derniers jours' : '30 derniers jours'}
        </p>
        <div
          className="flex items-end justify-between"
          style={{ height: 120, gap: byDay.length > 10 ? 2 : 8 }}
        >
          {byDay.map((d, i) => {
            const isToday = i === byDay.length - 1
            const h = Math.max(6, (d.stands / maxStands) * 100)
            const labelled = isToday || (byDay.length - 1 - i) % labelEvery === 0
            return (
              <div key={d.localDate} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[6px]"
                    style={{
                      height: `${h}%`,
                      background: isToday ? 'var(--accent)' : 'var(--surface-3)',
                    }}
                    aria-label={`${d.localDate} : ${d.stands} ${plural(d.stands, 'lever', 'levers')}`}
                  />
                </div>
                <span className="num text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {labelled ? weekdayInitial(d.localDate) : ' '}
                </span>
              </div>
            )
          })}
        </div>
        <p className="t-meta mt-3">
          {summary.total} {plural(summary.total, 'lever', 'levers')} en tout, sur{' '}
          {summary.active} {plural(summary.active, 'jour', 'jours')}
          {summary.best && summary.best.stands > 0 && (
            <> · meilleur jour : {summary.best.stands}</>
          )}
        </p>
      </section>

      {/* Counted totals */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <section className="rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
          <p className="t-card-eyebrow">Série</p>
          <p className="num mt-2" style={{ fontSize: 34 }}>
            {stats?.streak ?? 0}
          </p>
          <p className="t-meta mt-1">jours avec au moins 3 levers</p>
        </section>
        <section className="rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
          <p className="t-card-eyebrow">Temps bougé</p>
          <p className="num mt-2" style={{ fontSize: 34 }}>
            {minutesLabel(stats?.minutesMoved ?? 0)}
          </p>
          <p className="t-meta mt-1">
            routines terminées, sur {range === 'week' ? '7' : '30'} jours
          </p>
        </section>
      </div>

      <section className="mt-3 rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
        <p className="t-card-eyebrow">Réponse aux rappels</p>
        <p className="num mt-2" style={{ fontSize: 34 }}>
          {percent(stats?.adherence ?? null)}
        </p>
        <p className="t-meta mt-1">
          part des rappels suivis d’un « Fait » ou d’un report, sur 30 jours
        </p>
      </section>

      {lowAdherence && (
        <p className="t-meta mt-4" style={{ color: 'var(--text-2)' }}>
          Tu réponds à moins de 40 % des rappels. Un intervalle plus long est peut-être plus juste
          pour toi. Tu peux l’allonger dans les{' '}
          <Link
            to="/settings"
            className="underline underline-offset-4"
            style={{ color: 'var(--accent)' }}
          >
            réglages
          </Link>
          .
        </p>
      )}
    </div>
  )
}
