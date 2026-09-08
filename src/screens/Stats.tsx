import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Segmented } from '@/components/Segmented'
import { useStatsStore } from '@/stores/stats'
import { LOW_ADHERENCE } from '@/features/session/stats'
import { hoursLabel, percent, plural, standsLine } from '@/lib/format'
import { localDate, weekdayInitial } from '@/lib/date'
import { JournalDayCard } from '@/components/JournalDayCard'
import { useContentStore } from '@/stores/content'

/**
 * §11.5 — honest numbers and nothing else. No calories, no "sitting time
 * avoided", no estimated health benefit: those would be invented figures.
 * Everything here is either counted or a share of things counted.
 *
 * The journal below them is the same rule applied to the day rather than to the
 * week: it lists what happened and at what time, and the only figure it derives
 * is the focus time — the worked time minus the moved time, named as the
 * subtraction it is.
 */

/**
 * How tall the tallest bar is drawn, in pixels — not as a percentage.
 *
 * A percentage height inside a flex item that has no definite height of its own
 * resolves to auto, which is zero. Every bar was drawn 0 px tall, so this chart
 * had been an empty box since it was written; measuring it in the browser is
 * what turned that up.
 */
const BAR_MAX_PX = 104

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

  const journal = useMemo(() => stats?.journal ?? [], [stats])
  const totals = useMemo(
    () =>
      journal.reduce(
        (acc, d) => ({
          worked: acc.worked + d.workedS,
          moved: acc.moved + d.movedS,
          focus: acc.focus + d.focusS,
        }),
        { worked: 0, moved: 0, focus: 0 },
      ),
    [journal],
  )
  const today = localDate()
  const routineBySlug = useContentStore((s) => s.routineBySlug)
  const mine = useContentStore((s) => s.mine)
  const routineTitle = (slug: string) =>
    routineBySlug(slug)?.title ?? mine.find((r) => r.slug === slug)?.title

  return (
    <div className="gutter pb-8">
      <h1 className="t-screen pt-5 pb-4">Activité</h1>

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
          style={{ height: BAR_MAX_PX + 22, gap: byDay.length > 10 ? 2 : 8 }}
        >
          {byDay.map((d, i) => {
            const isToday = i === byDay.length - 1
            const h = d.stands === 0 ? 3 : Math.max(6, (d.stands / maxStands) * BAR_MAX_PX)
            const labelled = isToday || (byDay.length - 1 - i) % labelEvery === 0
            return (
              <div
                key={d.localDate}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <div
                  className="w-full rounded-t-[6px]"
                  style={{
                    height: h,
                    background: isToday
                      ? 'var(--accent)'
                      : d.stands === 0
                        ? 'var(--surface-2)'
                        : 'var(--surface-3)',
                  }}
                  aria-label={`${d.localDate} : ${d.stands} ${plural(d.stands, 'lever', 'levers')}`}
                />
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
          <p className="t-card-eyebrow">Réponse aux rappels</p>
          <p className="num mt-2" style={{ fontSize: 34 }}>
            {percent(stats?.adherence ?? null)}
          </p>
          <p className="t-meta mt-1">rappels suivis d’un « Fait » ou d’un report</p>
        </section>
      </div>

      {/* The three durations together: a value like « 7 h 12 » does not fit a
          half-width card at the size the counters use, and putting them side by
          side is also how they read — the third is the first minus the second. */}
      <section className="mt-3 rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
        <p className="t-card-eyebrow mb-3">
          Temps, sur {range === 'week' ? '7' : '30'} jours
        </p>
        <div className="flex items-start justify-between gap-2">
          {[
            { label: 'Travail', value: totals.worked },
            { label: 'Focus', value: totals.focus },
            { label: 'Bougé', value: totals.moved },
          ].map((t) => (
            <div key={t.label} className="min-w-0 flex-1">
              <p
                className="num whitespace-nowrap"
                style={{ fontSize: 20, lineHeight: 1.2 }}
              >
                {hoursLabel(t.value)}
              </p>
              <p className="t-meta mt-1">{t.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The journal: the same days, told rather than counted. */}
      <section className="mt-6">
        <h2 className="t-section mb-3">Journal</h2>
        {journal.length === 0 ? (
          <p className="t-meta">
            Rien encore sur cette période. Démarre une journée et elle s’écrira toute seule.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {journal.map((d) => (
              <JournalDayCard
                key={d.localDate}
                day={d}
                today={today}
                routineTitle={routineTitle}
              />
            ))}
          </div>
        )}
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
