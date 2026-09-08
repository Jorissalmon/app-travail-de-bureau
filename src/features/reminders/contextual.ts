import { KINDS } from './kinds'
import { nudgeFor } from '@/features/session/daypart'
import { PAIN_ZONE_LABEL } from '@/content'
import { PLAN_SLUG } from '@/features/plan/compose'
import type { AdaptivePlan, ReminderKind } from '@/lib/types'

/**
 * What a reminder says, and what it opens, given what the app actually knows.
 *
 * The mobility reminder used to be a fixed string pointing at a fixed routine:
 * « Pause mobilité. Trois minutes pour une zone qui coince. » — the same
 * sentence on the day someone reported an eight and on the day they reported a
 * one, opening « Hanches » either way. That is a timer with a body attached,
 * and it is the thing the pivot replaces.
 *
 * It now names the zone the plan was composed for, the time the plan actually
 * takes, and lands on the plan itself. § pivot — so does the stand reminder,
 * which is the point where the timer and the plan become one product: the
 * first reminder of the day that finds the plan undone opens it, and every
 * reminder after that is the ordinary three-minute break.
 *
 * The eye reminder is left alone. It is not about a painful zone, and dressing
 * it up as if it were would be the app pretending to know something.
 *
 * Pure, so the copy can be tested without a device and without the scheduler.
 */

export interface ContextualCopy {
  title: string
  body: string
  /** The one line the break prompt gives for doing this rather than ignoring it. */
  why: string
  /** The routine slug the alert screen and the notification tap should open. */
  routineSlug: string
}

export interface ContextualInput {
  /** Today's composed session, or null before the first composition. */
  plan: AdaptivePlan | null
  /**
   * Whether the plan has already been carried to the end today.
   *
   * This is the whole Timer ↔ Plan rule in one flag. A reminder every thirty
   * minutes that each time opened a six-minute session would be sixteen
   * minutes of exercise an hour, which nobody does and nobody asked for. So
   * the plan is the day's dose, served by the first reminder that finds it
   * undone; every reminder after it is the ordinary three-minute break the
   * app has always had.
   */
  planDoneToday: boolean
}

/** Nothing over this many characters survives a lock screen intact. */
const MAX_BODY = 90

/** « la nuque », « les poignets » — the article the zone actually takes. */
const PLURAL_ZONES = new Set(['hanches', 'poignets', 'chevilles'])

function zoneLine(plan: AdaptivePlan, zone: string): string {
  const minutes = Math.round(plan.durationS / 60)
  const strength = plan.blocks.filter((b) => b.type === 'strength').length
  const what =
    strength === 0
      ? 'Mobilité seule.'
      : `Mobilité, puis ${strength} mouvement${strength > 1 ? 's' : ''} de renforcement.`
  const article = PLURAL_ZONES.has(zone) ? 'les' : 'la'
  const body = `${minutes} min pour ${article} ${zone}. ${what}`
  return body.length > MAX_BODY ? `${minutes} min pour ${article} ${zone}.` : body
}

/**
 * True when the plan is in a state worth pointing a reminder at: composed, not
 * empty, aimed at a zone, and not already done today.
 */
function planIsDue(input: ContextualInput): input is ContextualInput & {
  plan: AdaptivePlan & { primaryZone: string }
} {
  const { plan, planDoneToday } = input
  return plan !== null && !planDoneToday && plan.blocks.length > 0 && plan.primaryZone !== null
}

export function contextualCopy(
  kind: ReminderKind,
  at: Date,
  input: ContextualInput,
): ContextualCopy {
  const fallback = KINDS[kind]

  // The eye reminder is not about a painful zone, and dressing it up as one
  // would be the app pretending to know something.
  if (kind === 'eyes') return { ...fallback }

  if (!planIsDue(input)) {
    // No plan to serve, or it is already done. The stand reminder keeps its
    // hour-context nudge, which is the contextual thing it has always had.
    return {
      title: fallback.title,
      body: kind === 'stand' ? nudgeFor(at) : fallback.body,
      why: fallback.why,
      routineSlug: fallback.routineSlug,
    }
  }

  const plan = input.plan as AdaptivePlan
  const zone = PAIN_ZONE_LABEL[plan.primaryZone as string] ?? (plan.primaryZone as string)

  return {
    // The stand reminder keeps its own word — getting up is what it is for —
    // and says what getting up will get you. The mobility one is named by the
    // zone, because that is all it is.
    title: kind === 'stand' ? fallback.title : `Ta ${zone}.`,
    body: zoneLine(plan, zone),
    // Straight from the composer, so the prompt can never give a reason the
    // engine did not use.
    why: plan.rationale,
    routineSlug: PLAN_SLUG,
  }
}

/**
 * When to put the two mobility reminders, read off the hours the person has
 * actually done sessions at.
 *
 * Counted, not inferred: the input is the completion journal, which is a list
 * of sessions carried to the end. An hour someone has never moved at is not
 * proposed however convenient it looks, and with fewer than `MIN_SAMPLE`
 * sessions nothing is proposed at all — two data points are not a habit, and a
 * schedule rebuilt on two data points is worse than the default.
 *
 * Returns "HH:MM" strings on the half hour, earliest first, or null when there
 * is not enough to say. The caller offers them; nothing here reschedules on its
 * own, because a reminder that silently moves is a reminder nobody trusts.
 */
const MIN_SAMPLE = 8

export function suggestMobilityTimes(
  completions: { completedAt: string }[],
  count = 2,
): string[] | null {
  if (completions.length < MIN_SAMPLE) return null

  const byHalf = new Map<number, number>()
  for (const c of completions) {
    const d = new Date(c.completedAt)
    if (Number.isNaN(d.getTime())) continue
    // Bucketed on the half hour: the minute someone finished is noise, the
    // half of the hour they tend to move in is not.
    const bucket = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0)
    byHalf.set(bucket, (byHalf.get(bucket) ?? 0) + 1)
  }
  if (byHalf.size === 0) return null

  const ranked = [...byHalf.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([bucket]) => bucket)

  // Spread them out: two reminders inside the same hour is one reminder and a
  // duplicate. Two hours apart is the smallest gap that reads as two moments.
  const picked: number[] = []
  for (const bucket of ranked) {
    if (picked.length >= count) break
    if (picked.some((p) => Math.abs(p - bucket) < 4)) continue
    picked.push(bucket)
  }
  if (picked.length === 0) return null

  return picked
    .sort((a, b) => a - b)
    .map((b) => `${String(Math.floor(b / 2)).padStart(2, '0')}:${b % 2 === 0 ? '00' : '30'}`)
}
