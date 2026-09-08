import { create } from 'zustand'
import { localDate } from '@/lib/date'
import { place, loadPlace } from '@/features/place/place'
import { PLAN_SLUG, TOP_UP_S, composePlan, planToRoutine } from '@/features/plan/compose'
import { readCompletionJournal } from '@/features/reminders/events'
import { flushPain, loadPain, painEntries, pullPain, recordPain } from '@/features/plan/pain'
import { emptyProfile, loadProfile, profile, saveProfile } from '@/features/plan/profile'
import { trackNow } from '@/features/analytics/events'
import { useContentStore } from './content'
import type { AdaptivePlan, PainEntry, PainProfile, PainScore, Routine, Zone } from '@/lib/types'

/**
 * The plan domain store: the profile, the pain journal and today's composed
 * session, in one place so every screen reads the same object.
 *
 * The plan itself is never persisted. It is a pure function of the profile, the
 * journal and the date (see features/plan/compose), so storing it would only
 * create a second version of the truth that can go stale at midnight. It is
 * recomposed whenever one of its inputs moves — a rating, a place change, a
 * catalogue refresh — and that is also what makes the adaptation visible: the
 * card changes on the screen the moment the answer is given.
 */

interface PlanState {
  profile: PainProfile | null
  entries: PainEntry[]
  plan: AdaptivePlan | null
  /** The plan as the player reads it, or null before the first composition. */
  planRoutine: Routine | null
  /**
   * The short session a reminder serves once the day's plan is done.
   *
   * Composed by the same engine, for the same zones, in ninety seconds. It
   * exists so that a reminder always opens an adaptive session rather than
   * falling back to a fixed routine — while keeping the day's dose the day's
   * dose. A reminder every thirty minutes that reopened the full six-minute
   * plan would be sixteen minutes of exercise an hour, which nobody does.
   */
  topUpRoutine: Routine | null
  /**
   * Whether today's plan has already been carried to the end.
   *
   * The Timer ↔ Plan rule reads this and nothing else: while it is false the
   * next reminder opens the plan, and once it is true the reminders go back to
   * being the three-minute break. Derived from the completion journal, which is
   * a record of sessions actually finished — not from a flag the app sets when
   * it thinks you probably did it.
   */
  doneToday: boolean
  loaded: boolean

  load: () => Promise<void>
  /** Re-run the composition against whatever the inputs say now. */
  recompose: () => void
  setProfile: (next: PainProfile) => Promise<void>
  /** Called by the player when the composed session reaches its last block. */
  markPlanDone: () => void
  /** Re-read the completion journal, e.g. after the day rolls over. */
  refreshDone: () => Promise<void>
  /**
   * Push what this device holds, pull what the account holds, recompose.
   * A no-op without an account, which is the normal case and not an error.
   */
  sync: () => Promise<void>
  rate: (input: {
    zone: Zone
    score: PainScore
    source: PainEntry['source']
    routineSlug?: string
  }) => Promise<void>
}

export const usePlanStore = create<PlanState>((set, get) => ({
  profile: null,
  entries: [],
  plan: null,
  planRoutine: null,
  topUpRoutine: null,
  doneToday: false,
  loaded: false,

  recompose: () => {
    const content = useContentStore.getState()
    const current = get().profile ?? emptyProfile()
    const before = get().plan
    const plan = composePlan({
      today: localDate(),
      profile: current,
      entries: get().entries,
      // The shipped catalogue, not the place-adapted view: the composer applies
      // discretion itself, per movement, and adaptToPlace works on whole
      // routines. Running both would filter twice and hide the reason why.
      routines: content.routines,
      exerciseByKey: content.exerciseByKey,
      place: place(),
    })
    const topUp = composePlan({
      today: localDate(),
      profile: current,
      entries: get().entries,
      routines: content.routines,
      exerciseByKey: content.exerciseByKey,
      place: place(),
      budgetS: TOP_UP_S,
    })
    set({
      plan,
      planRoutine: planToRoutine(plan),
      topUpRoutine: topUp.blocks.length > 0 ? planToRoutine(topUp) : null,
    })

    // Only when it actually moved, so the log says "le plan a changé" and not
    // "l'écran a été ouvert".
    const strength = plan.blocks.filter((b) => b.type === 'strength').length
    if (before && before.goal !== plan.goal && plan.primaryZone) {
      trackNow({
        name: 'plan_adapted',
        zone: plan.primaryZone,
        from: before.goal,
        to: plan.goal,
        strengthBlocks: strength,
      })
    }
  },

  load: async () => {
    await Promise.all([loadProfile(), loadPain(), loadPlace()])
    set({ profile: profile(), entries: painEntries(), loaded: true })
    get().recompose()
    await get().refreshDone()
  },

  refreshDone: async () => {
    try {
      const today = localDate()
      const done = await readCompletionJournal()
      set({
        doneToday: done.some((c) => c.routineSlug === PLAN_SLUG && c.localDate === today),
      })
    } catch {
      // A journal that will not read must not make the app forget the plan
      // exists; the worst case is a reminder offering a session already done.
    }
  },

  markPlanDone: () => set({ doneToday: true }),

  sync: async () => {
    await flushPain()
    await pullPain()
    const merged = painEntries()
    // Only touch state when the pull actually brought something new: an
    // identical array would recompose the plan and reset the card for nothing.
    if (merged.length !== get().entries.length) {
      set({ entries: [...merged] })
      get().recompose()
    }
  },

  setProfile: async (next) => {
    await saveProfile(next)
    set({ profile: next })
    get().recompose()
  },

  rate: async (input) => {
    await recordPain(input)
    set({ entries: [...painEntries()] })
    trackNow({
      name: 'pain_rated',
      zone: input.zone,
      score: input.score,
      source: input.source,
    })
    // The whole point of asking: the next plan is composed from this answer.
    get().recompose()
  },
}))
