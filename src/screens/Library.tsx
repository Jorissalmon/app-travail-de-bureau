import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { SearchField } from '@/components/SearchField'
import { RoutineCard } from '@/components/RoutineCard'
import { Pill } from '@/components/Pill'
import { useContentStore } from '@/stores/content'
import { ZONES, ZONE_LABEL } from '@/content'
import { place, suitsPlace } from '@/features/place/place'
import type { Zone } from '@/lib/types'

/** §11.2 — routines grouped by zone, horizontal zone filter, persistent search. */
export function Library() {
  const routines = useContentStore((s) => s.adapted)
  const exerciseByKey = useContentStore((s) => s.exerciseByKey)
  const mine = useContentStore((s) => s.mine)
  const refreshMine = useContentStore((s) => s.refreshMine)
  const navigate = useNavigate()
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

  // A routine of one's own answers to the search box like any other, but never
  // to the zone filter: it is not filed under a body part.
  const mineFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (activeZone) return []
    if (!q) return mine
    return mine.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.steps.some((s) => s.name.toLowerCase().includes(q)),
    )
  }, [mine, query, activeZone])

  async function create() {
    const { createCustomRoutine } = await import('@/features/routines/custom')
    const routine = await createCustomRoutine('Ma routine')
    await refreshMine()
    navigate(`/library/${routine.slug}/composer`)
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

      {grouped.length === 0 && mineFiltered.length === 0 && (
        <p className="t-meta mt-8">Aucune routine ne correspond à ta recherche.</p>
      )}

      {!activeZone && (
        <section className="mt-6">
          <h2 className="t-section mb-3">Mes routines</h2>
          <div className="flex flex-col gap-3">
            {mineFiltered.map((r) => (
              <RoutineCard key={r.slug} routine={r} />
            ))}
            <button
              type="button"
              onClick={() => void create()}
              className="flex items-center justify-center gap-2 rounded-[20px] py-4"
              style={{ background: 'var(--surface)', color: 'var(--text-2)' }}
            >
              <Plus size={18} />
              <span className="text-[15px]" style={{ fontWeight: 700 }}>
                Composer une routine
              </span>
            </button>
          </div>
        </section>
      )}

      <div className="mt-7 flex flex-col gap-7">
        {grouped.map((g) => (
          <section key={g.zone}>
            <h2 className="t-section mb-3">{ZONE_LABEL[g.zone]}</h2>
            <div className="flex flex-col gap-3">
              {g.routines.map((r) => (
                <div key={r.slug}>
                  <RoutineCard routine={r} />
                  {/* Shown, not hidden: you may well be at home tomorrow. */}
                  {!suitsPlace(r, place(), exerciseByKey) && (
                    <p className="t-meta mt-1.5 ml-1">
                      Plutôt à la maison — trop de mouvements peu discrets pour un open space.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
