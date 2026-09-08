import { describe, expect, it } from 'vitest'
import { reconcileArticles, reconcileExercises, reconcileRoutines } from './reconcile'
import { LOCAL_ROUTINES } from './index'
import { composePlan } from '@/features/plan/compose'
import { LOCAL_EXERCISES } from './index'
import type { Article, Exercise, Routine } from '@/lib/types'

/**
 * The regression these exist for: the app updates over the air in seconds, the
 * API and the database update when someone deploys. Every release has a window
 * where the new client reads an old catalogue, and the pivot made that window
 * a TypeError on the home screen.
 */

/** A routine exactly as the deployed API returned it before the pivot. */
function prePivot(slug: string): Routine {
  const r = LOCAL_ROUTINES.find((x) => x.slug === slug) as Routine
  const stripped = { ...r } as Partial<Routine>
  delete stripped.goal
  delete stripped.targetZones
  return stripped as Routine
}

describe('reconcileRoutines', () => {
  it('fills the fields the old API never sent, from the bundled entry', () => {
    const [out] = reconcileRoutines([prePivot('nuque')])
    const bundled = LOCAL_ROUTINES.find((r) => r.slug === 'nuque')
    expect(out?.goal).toBe(bundled?.goal)
    expect(out?.targetZones).toEqual(bundled?.targetZones)
  })

  it('treats an empty targetZones as absent', () => {
    // A migrated database that was never re-seeded holds '{}', which would hide
    // the routine from every plan without ever raising an error.
    const empty = { ...(prePivot('nuque') as Routine), targetZones: [] }
    expect(reconcileRoutines([empty])[0]?.targetZones.length).toBeGreaterThan(0)
  })

  it('keeps what the server does send — content really does change there', () => {
    const moved = { ...(LOCAL_ROUTINES[0] as Routine), goal: 'strength' as const }
    expect(reconcileRoutines([moved])[0]?.goal).toBe('strength')
  })

  it('derives a conservative default for a routine the bundle never saw', () => {
    const unknown = { ...prePivot('nuque'), slug: 'ajoutee-apres-ce-build' }
    const [out] = reconcileRoutines([unknown as Routine])
    expect(out?.goal).toBe('prevention')
    // Its own body zone, so the plan can at least reach it.
    expect(out?.targetZones).toEqual(['nuque'])
  })

  it('gives a moment-zone routine no target rather than a wrong one', () => {
    const unknown = { ...prePivot('debout'), slug: 'inconnue', zone: 'bureau' as const }
    expect(reconcileRoutines([unknown as Routine])[0]?.targetZones).toEqual([])
  })
})

describe('reconcileExercises', () => {
  it('fills a missing type from the bundled entry', () => {
    const bundled = LOCAL_EXERCISES.find((e) => e.key === 'omoplates-tenu') as Exercise
    const stripped = { ...bundled } as Partial<Exercise>
    delete stripped.type
    expect(reconcileExercises([stripped as Exercise])[0]?.type).toBe('strength')
  })

  it('calls an unknown, untyped movement mobility, never strength', () => {
    // Loading a zone that hurts on no information is the one thing the plan
    // must not be talked into.
    const alien = { key: 'inconnu', type: undefined } as unknown as Exercise
    expect(reconcileExercises([alien])[0]?.type).toBe('mobility')
  })
})

describe('reconcileArticles', () => {
  it('drops a row the renderer cannot read', () => {
    const rows = [{ slug: 'ok', bodyMd: 'x' }, { slug: 'ko' }] as Article[]
    expect(reconcileArticles(rows)).toHaveLength(1)
  })
})

describe('the whole regression, end to end', () => {
  it('composes a plan against a catalogue served by the pre-pivot API', () => {
    const stale = LOCAL_ROUTINES.map((r) => prePivot(r.slug))
    const byKey = (key: string) => LOCAL_EXERCISES.find((e) => e.key === key)

    // Unreconciled, this is the crash that shipped.
    expect(() =>
      composePlan({
        today: '2026-03-16',
        profile: {
          zones: ['nuque'],
          baseline: { nuque: 7 },
          since: null,
          minutes: 6,
          startedAt: '2026-03-01T08:00:00.000Z',
        },
        entries: [],
        routines: stale,
        exerciseByKey: byKey,
        place: 'bureau',
      }),
    ).not.toThrow()

    // Reconciled, it composes a real session.
    const plan = composePlan({
      today: '2026-03-16',
      profile: {
        zones: ['nuque'],
        baseline: { nuque: 7 },
        since: null,
        minutes: 6,
        startedAt: '2026-03-01T08:00:00.000Z',
      },
      entries: [],
      routines: reconcileRoutines(stale),
      exerciseByKey: byKey,
      place: 'bureau',
    })
    expect(plan.blocks.length).toBeGreaterThan(3)
    expect(plan.primaryZone).toBe('nuque')
  })
})
