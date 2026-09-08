import { describe, expect, it } from 'vitest'
import {
  HIGH_PAIN,
  composePlan,
  planGoal,
  planToRoutine,
  rankZones,
  strengthSlots,
  type ComposeInput,
} from './compose'
import { LOCAL_EXERCISES, LOCAL_ROUTINES } from '@/content'
import type { PainEntry, PainProfile, Zone } from '@/lib/types'

/**
 * The composition rules, pinned.
 *
 * Two of these tests are the product promise in executable form: a zone
 * reported high never gets a load block, and a plan announces exactly the
 * duration its blocks add up to. If either stops being true the app is making
 * a claim it cannot keep.
 */

const byKey = (key: string) => LOCAL_EXERCISES.find((e) => e.key === key)

const TODAY = '2026-03-16'

function profile(over: Partial<PainProfile> = {}): PainProfile {
  return {
    zones: ['nuque'],
    baseline: { nuque: 7 },
    since: '1-6-mois',
    minutes: 6,
    startedAt: '2026-03-01T08:00:00.000Z',
    ...over,
  }
}

function entry(zone: Zone, score: number, localDate: string): PainEntry {
  return {
    at: `${localDate}T17:00:00.000Z`,
    localDate,
    zone,
    score,
    source: 'post-session',
  }
}

function input(over: Partial<ComposeInput> = {}): ComposeInput {
  return {
    today: TODAY,
    profile: profile(),
    entries: [],
    routines: LOCAL_ROUTINES,
    exerciseByKey: byKey,
    place: 'bureau',
    ...over,
  }
}

describe('strengthSlots', () => {
  it('gives none to a zone reported at six or more, whatever the trend', () => {
    expect(strengthSlots(7, -3, 8)).toBe(0)
    expect(strengthSlots(HIGH_PAIN, -5, 8)).toBe(0)
  })

  it('gives none to a moderate zone that is not moving', () => {
    expect(strengthSlots(4, null, 8)).toBe(0)
    expect(strengthSlots(4, 0, 8)).toBe(0)
  })

  it('adds one once the fortnight has actually come down', () => {
    expect(strengthSlots(4, -1.5, 8)).toBe(1)
  })

  it('gives a calm zone one, and two when it is also improving', () => {
    expect(strengthSlots(1, null, 8)).toBe(1)
    expect(strengthSlots(1, -2, 8)).toBe(2)
  })

  it('never fits two into four minutes', () => {
    expect(strengthSlots(1, -2, 4)).toBe(1)
  })

  it('treats an unrated zone as calm rather than as painful', () => {
    expect(strengthSlots(null, null, 6)).toBe(1)
  })
})

describe('planGoal', () => {
  it('is pain relief while the zone is at three or more', () => {
    expect(planGoal(3, 0)).toBe('pain_relief')
    expect(planGoal(8, 0)).toBe('pain_relief')
  })

  it('is prevention on a calm zone, strength once two blocks are earned', () => {
    expect(planGoal(1, 1)).toBe('prevention')
    expect(planGoal(1, 2)).toBe('strength')
  })
})

describe('rankZones', () => {
  it('puts the most painful first', () => {
    const p = profile({ zones: ['nuque', 'poignets'], baseline: { nuque: 3, poignets: 8 } })
    expect(rankZones([], p)[0]).toBe('poignets')
  })

  it('prefers the latest answer to what was declared at first run', () => {
    const p = profile({ zones: ['nuque', 'poignets'], baseline: { nuque: 3, poignets: 8 } })
    const entries = [entry('poignets', 1, '2026-03-15')]
    expect(rankZones(entries, p)[0]).toBe('nuque')
  })

  it('picks up a zone that was rated but never declared', () => {
    const p = profile({ zones: [], baseline: {} })
    expect(rankZones([entry('lombaires', 5, '2026-03-15')], p)).toEqual(['lombaires'])
  })

  it('falls back to the zones the app has articles about when nothing is known', () => {
    expect(rankZones([], profile({ zones: [], baseline: {} }))).toEqual([
      'nuque',
      'dos',
      'lombaires',
    ])
  })
})

describe('composePlan', () => {
  it('announces the duration its blocks add up to', () => {
    for (const minutes of [4, 6, 8] as const) {
      const plan = composePlan(input({ profile: profile({ minutes }) }))
      const sum = plan.blocks.reduce((n, b) => n + b.durationS, 0)
      expect(sum, `${minutes} min`).toBe(plan.durationS)
    }
  })

  it('stays inside the time the person said they had', () => {
    for (const minutes of [4, 6, 8] as const) {
      const plan = composePlan(input({ profile: profile({ minutes }) }))
      expect(plan.durationS, `${minutes} min`).toBeLessThanOrEqual(minutes * 60)
    }
  })

  it('uses most of it rather than stopping at two movements', () => {
    for (const minutes of [4, 6, 8] as const) {
      const plan = composePlan(input({ profile: profile({ minutes }) }))
      expect(plan.durationS, `${minutes} min`).toBeGreaterThanOrEqual(minutes * 60 - 45)
    }
  })

  it('numbers its blocks 1..n', () => {
    const plan = composePlan(input())
    expect(plan.blocks.map((b) => b.position)).toEqual(plan.blocks.map((_, i) => i + 1))
  })

  it('never repeats a movement inside one session', () => {
    const plan = composePlan(input({ profile: profile({ minutes: 8 }) }))
    const keys = plan.blocks.map((b) => b.exerciseKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('puts no load on a zone reported at seven', () => {
    const plan = composePlan(input({ entries: [entry('nuque', 7, '2026-03-15')] }))
    expect(plan.blocks.filter((b) => b.type === 'strength')).toHaveLength(0)
    expect(plan.goal).toBe('pain_relief')
  })

  it('introduces load once the reported pain has come down', () => {
    const entries = [
      entry('nuque', 7, '2026-03-09'),
      entry('nuque', 6, '2026-03-10'),
      entry('nuque', 4, '2026-03-13'),
      entry('nuque', 2, '2026-03-14'),
      entry('nuque', 2, '2026-03-15'),
    ]
    const plan = composePlan(input({ entries }))
    expect(plan.blocks.filter((b) => b.type === 'strength').length).toBeGreaterThan(0)
  })

  it('ends on a reset, and only on a reset', () => {
    const plan = composePlan(input())
    const last = plan.blocks[plan.blocks.length - 1]
    expect(last?.type).toBe('reset')
    expect(plan.blocks.filter((b) => b.type === 'reset')).toHaveLength(1)
  })

  it('opens on mobility, never on a load block', () => {
    const entries = [
      entry('nuque', 2, '2026-03-13'),
      entry('nuque', 1, '2026-03-14'),
      entry('nuque', 1, '2026-03-15'),
      entry('nuque', 1, '2026-03-12'),
    ]
    const plan = composePlan(input({ entries }))
    expect(plan.blocks[0]?.type).toBe('mobility')
  })

  it('serves nothing indiscreet in an open space', () => {
    const plan = composePlan(input({ place: 'open-space', profile: profile({ minutes: 8 }) }))
    for (const b of plan.blocks) {
      expect(byKey(b.exerciseKey)?.discreet, `${b.exerciseKey}`).toBe(true)
    }
  })

  it('leaves everything on the table at home', () => {
    const plan = composePlan(input({ place: 'maison' }))
    expect(plan.blocks.length).toBeGreaterThan(0)
  })

  it('covers the second painful zone too', () => {
    const p = profile({ zones: ['nuque', 'poignets'], baseline: { nuque: 7, poignets: 6 }, minutes: 8 })
    const plan = composePlan(input({ profile: p }))
    expect(plan.targetZones).toContain('nuque')
    expect(plan.targetZones).toContain('poignets')
  })

  it('does not serve the same opening movement two days running', () => {
    const a = composePlan(input({ today: '2026-03-16' }))
    const b = composePlan(input({ today: '2026-03-17' }))
    expect(a.blocks[0]?.exerciseKey).not.toBe(b.blocks[0]?.exerciseKey)
  })

  it('is reproducible: same inputs, same session', () => {
    expect(composePlan(input())).toEqual(composePlan(input()))
  })

  it('still composes something for someone who declared nothing', () => {
    const plan = composePlan(input({ profile: profile({ zones: [], baseline: {} }) }))
    expect(plan.blocks.length).toBeGreaterThan(2)
    expect(plan.goal).toBe('prevention')
    expect(plan.rationale).toContain('Rien de déclaré')
  })

  it('names the number it used, and claims nothing else', () => {
    const plan = composePlan(input({ entries: [entry('nuque', 7, '2026-03-15')] }))
    expect(plan.rationale).toContain('7/10')
    expect(plan.rationale.toLowerCase()).not.toMatch(/bravo|félicit|excellent|progrès/)
  })

  it('asks its closing question about the zone it was built for', () => {
    const plan = composePlan(input({ entries: [entry('poignets', 9, '2026-03-15')] }))
    expect(plan.primaryZone).toBe('poignets')
  })

  it('degrades to an empty plan rather than throwing on an empty catalogue', () => {
    const plan = composePlan(input({ routines: [] }))
    expect(plan.blocks).toEqual([])
    expect(plan.durationS).toBe(0)
  })
})

describe('planToRoutine', () => {
  it('produces a routine whose duration matches its steps', () => {
    const r = planToRoutine(composePlan(input()))
    expect(r.steps.reduce((n, s) => n + s.durationS, 0)).toBe(r.durationS)
    expect(r.steps.map((s) => s.position)).toEqual(r.steps.map((_, i) => i + 1))
  })
})
