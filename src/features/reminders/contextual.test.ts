import { describe, expect, it } from 'vitest'
import { contextualCopy, suggestMobilityTimes } from './contextual'
import { KINDS } from './kinds'
import { PLAN_SLUG } from '@/features/plan/compose'
import type { AdaptivePlan, PlanBlock } from '@/lib/types'

const AT = new Date('2026-03-16T10:30:00')

function block(over: Partial<PlanBlock> = {}): PlanBlock {
  return {
    position: 1,
    name: 'Menton rentré',
    durationS: 30,
    cue: '…',
    figureKey: 'menton-rentre',
    exerciseKey: 'menton-rentre',
    type: 'mobility',
    forZone: 'nuque',
    ...over,
  }
}

function plan(over: Partial<AdaptivePlan> = {}): AdaptivePlan {
  return {
    id: 'plan-2026-03-16',
    localDate: '2026-03-16',
    durationS: 360,
    goal: 'pain_relief',
    targetZones: ['nuque'],
    primaryZone: 'nuque',
    blocks: [block()],
    rationale: '…',
    ...over,
  }
}

describe('contextualCopy', () => {
  it('names the zone the plan was composed for, and opens the plan', () => {
    const copy = contextualCopy('mobility', AT, plan())
    expect(copy.title).toBe('Ta nuque.')
    expect(copy.body).toContain('6 min')
    expect(copy.routineSlug).toBe(PLAN_SLUG)
  })

  it('gives the composer\'s own reason, not a canned one', () => {
    const p = plan({ rationale: 'Nuque à 7/10 : mobilité seule aujourd’hui.' })
    expect(contextualCopy('mobility', AT, p).why).toBe(p.rationale)
  })

  it('says what the session is made of', () => {
    const withLoad = plan({ blocks: [block(), block({ type: 'strength', position: 2 })] })
    expect(contextualCopy('mobility', AT, withLoad).body).toContain('1 mouvement de renforcement')
    expect(contextualCopy('mobility', AT, plan()).body).toContain('Mobilité seule')
  })

  it('falls back to the ordinary sentence when there is no plan', () => {
    expect(contextualCopy('mobility', AT, null)).toEqual({ ...KINDS.mobility })
  })

  it('falls back when the plan targets nothing', () => {
    const blank = plan({ primaryZone: null, blocks: [], targetZones: [] })
    expect(contextualCopy('mobility', AT, blank)).toEqual({ ...KINDS.mobility })
  })

  it('leaves the stand reminder on the hour, not on the body', () => {
    const copy = contextualCopy('stand', AT, plan())
    expect(copy.title).toBe(KINDS.stand.title)
    expect(copy.routineSlug).toBe(KINDS.stand.routineSlug)
  })

  it('leaves the eye reminder alone', () => {
    expect(contextualCopy('eyes', AT, plan())).toEqual({ ...KINDS.eyes })
  })

  it('keeps the body short enough for a lock screen', () => {
    const long = plan({ primaryZone: 'lombaires', blocks: [block({ forZone: 'lombaires' })] })
    expect(contextualCopy('mobility', AT, long).body.length).toBeLessThanOrEqual(90)
  })
})

describe('suggestMobilityTimes', () => {
  // Local time, deliberately without a Z: the suggestion is about the hour the
  // person moved at where they live, and a fixture in UTC would drift with the
  // machine running the tests.
  const at = (hhmm: string) => ({ completedAt: `2026-03-16T${hhmm}:00` })

  it('says nothing until there is enough to say', () => {
    expect(suggestMobilityTimes([at('10:05'), at('10:12')])).toBeNull()
  })

  it('proposes the half hours actually moved in', () => {
    const done = [
      ...Array(4).fill(at('10:05')),
      ...Array(4).fill(at('15:40')),
      at('08:00'),
    ]
    expect(suggestMobilityTimes(done)).toEqual(['10:00', '15:30'])
  })

  it('never puts two reminders inside the same couple of hours', () => {
    const done = [...Array(5).fill(at('10:05')), ...Array(4).fill(at('10:40'))]
    expect(suggestMobilityTimes(done)).toEqual(['10:00'])
  })

  it('ignores a timestamp it cannot read', () => {
    const done = [...Array(8).fill({ completedAt: 'pas une date' })]
    expect(suggestMobilityTimes(done)).toBeNull()
  })
})
