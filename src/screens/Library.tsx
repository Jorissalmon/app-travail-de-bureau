import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchField } from '@/components/SearchField'
import { RoutineCard } from '@/components/RoutineCard'
import { Pill } from '@/components/Pill'
import { useContentStore } from '@/stores/content'
import { ZONES, ZONE_LABEL } from '@/content'
import type { Zone } from '@/lib/types'

/** §11.2 — routines grouped by zone, horizontal zone filter, persistent search. */
export function Library() {
  const routines = useContentStore((s) => s.routines)
  const [params, setParams] = useSearchParams()

  const [query, setQuery] = useState(params.get('q') ?? '')
  const activeZone = (params.get('zone') as Zone | null) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return routines.filter((r) => {
      if (activeZone && r.zone !== activeZone) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.steps.some((s) => s.name.toLowerCase().includes(q))
      )
    })
  }, [routines, query, activeZone])

  const grouped = useMemo(() => {
    const map = new Map<Zone, typeof filtered>()
    for (const r of filtered) {
      const list = map.get(r.zone) ?? []
      list.push(r)
      map.set(r.zone, list)
    }
    return ZONES.map((z) => ({ zone: z.zone, routines: map.get(z.zone) ?? [] })).filter(
      (g) => g.routines.length > 0,
    )
  }, [filtered])

  function setZone(zone: Zone | null) {
    const next = new URLSearchParams(params)
    if (zone) next.set('zone', zone)
    else next.delete('zone')
    setParams(next, { replace: true })
  }

  return (
    <div className="gutter pb-8">
      <h1 className="t-screen pt-5 pb-4">Routines</h1>

      <SearchField value={query} onChange={setQuery} />

      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        <button type="button" onClick={() => setZone(null)} aria-pressed={activeZone === null}>
          <Pill variant={activeZone === null ? 'accent' : 'neutral'}>Toutes</Pill>
        </button>
        {ZONES.map((z) => (
          <button
            key={z.zone}
            type="button"
            onClick={() => setZone(z.zone)}
            aria-pressed={activeZone === z.zone}
            className="shrink-0"
          >
            <Pill variant={activeZone === z.zone ? 'accent' : 'neutral'}>{z.label}</Pill>
          </button>
        ))}
      </div>

      {grouped.length === 0 && (
        <p className="t-meta mt-8">Aucune routine ne correspond à ta recherche.</p>
      )}

      <div className="mt-5 flex flex-col gap-7">
        {grouped.map((g) => (
          <section key={g.zone}>
            <h2 className="t-section mb-3">{ZONE_LABEL[g.zone]}</h2>
            <div className="flex flex-col gap-3">
              {g.routines.map((r) => (
                <RoutineCard key={r.slug} routine={r} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
