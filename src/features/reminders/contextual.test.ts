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

/** The default situation: a plan composed and not yet done. */
function due(over: Partial<AdaptivePlan> = {}) {
  return { plan: plan(over), planDoneToday: false }
}

describe('contextualCopy — the Timer x Plan rule', () => {
  it('sends the stand reminder to the plan while the plan is undone', () => {
    const copy = contextualCopy('stand', AT, due())
    expect(copy.routineSlug).toBe(PLAN_SLUG)
    expect(copy.body).toContain('6 min')
    expect(copy.body).toContain('nuque')
  })

  it('still sends it to the plan once the plan is done — never to a fixed routine', () => {
    // The whole point of the merge: a reminder always opens an adaptive
    // session. Falling back to `debout` was the old product coming back
    // through the notification.
    const copy = contextualCopy('stand', AT, { plan: plan(), planDoneToday: true })
    expect(copy.routineSlug).toBe(PLAN_SLUG)
  })

  it('says plainly that the day is done and this is a top-up', () => {
    const copy = contextualCopy('mobility', AT, { plan: plan(), planDoneToday: true, topUpS: 90 })
    expect(copy.body).toContain('Séance du jour faite')
    expect(copy.body).toContain('90 secondes')
    expect(copy.why).toContain('appoint')
  })

  it('keeps the hour-context nudge when there is no plan at all', () => {
    const morning = contextualCopy('stand', new Date('2026-03-16T09:30:00'), {
      plan: null,
      planDoneToday: false,
    })
    const evening = contextualCopy('stand', new Date('2026-03-16T18:30:00'), {
      plan: null,
      planDoneToday: false,
    })
    expect(morning.routineSlug).toBe(KINDS.stand.routineSlug)
    expect(morning.body).not.toBe(evening.body)
  })

  it('keeps the word « Debout » on the stand reminder even when it opens the plan', () => {
    expect(contextualCopy('stand', AT, due()).title).toBe(KINDS.stand.title)
  })
})

describe('contextualCopy', () => {
  it('names the zone the plan was composed for, and opens the plan', () => {
    const copy = contextualCopy('mobility', AT, due())
    expect(copy.title).toBe('Ta nuque.')
    expect(copy.body).toContain('6 min')
    expect(copy.routineSlug).toBe(PLAN_SLUG)
  })

  it("gives the composer's own reason, not a canned one", () => {
    const rationale = 'Nuque à 7/10 : mobilité seule aujourd’hui.'
    expect(contextualCopy('mobility', AT, due({ rationale })).why).toBe(rationale)
  })

  it('says what the session is made of', () => {
    const withLoad = due({ blocks: [block(), block({ type: 'strength', position: 2 })] })
    expect(contextualCopy('mobility', AT, withLoad).body).toContain('1 mouvement de renforcement')
    expect(contextualCopy('mobility', AT, due()).body).toContain('Mobilité seule')
  })

  it('takes the article the zone actually needs', () => {
    const wrists = due({ primaryZone: 'poignets', targetZones: ['poignets'] })
    expect(contextualCopy('mobility', AT, wrists).body).toContain('les poignets')
    expect(contextualCopy('mobility', AT, due()).body).toContain('la nuque')
  })

  it('falls back to the ordinary sentence when there is no plan', () => {
    const copy = contextualCopy('mobility', AT, { plan: null, planDoneToday: false })
    expect(copy).toEqual({ ...KINDS.mobility })
  })

  it('falls back when the plan targets nothing', () => {
    const blank = due({ primaryZone: null, blocks: [], targetZones: [] })
    expect(contextualCopy('mobility', AT, blank)).toEqual({ ...KINDS.mobility })
  })

  it('leaves the eye reminder alone, plan or no plan', () => {
    expect(contextualCopy('eyes', AT, due())).toEqual({ ...KINDS.eyes })
    expect(contextualCopy('eyes', AT, { plan: null, planDoneToday: false })).toEqual({
      ...KINDS.eyes,
    })
  })

  it('keeps the body short enough for a lock screen', () => {
    const long = due({ primaryZone: 'lombaires', blocks: [block({ forZone: 'lombaires' })] })
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
