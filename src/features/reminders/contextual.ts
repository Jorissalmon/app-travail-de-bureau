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
 * takes, and lands on the plan itself. The stand and eye reminders are left
 * alone: they are not about a painful zone, and dressing them up as if they
 * were would be the app pretending to know something.
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

/** Nothing over this many characters survives a lock screen intact. */
const MAX_BODY = 90

export function contextualCopy(
  kind: ReminderKind,
  at: Date,
  plan: AdaptivePlan | null,
): ContextualCopy {
  const fallback = KINDS[kind]

  if (kind === 'stand') {
    // Already contextual, on the hour rather than on the body.
    return {
      title: fallback.title,
      body: nudgeFor(at),
      why: fallback.why,
      routineSlug: fallback.routineSlug,
    }
  }
  if (kind !== 'mobility') return { ...fallback }

  // No plan yet, or a plan with nothing in it: say the ordinary thing rather
  // than a personalised sentence built on no information.
  if (!plan || plan.blocks.length === 0 || plan.primaryZone === null) return { ...fallback }

  const zone = PAIN_ZONE_LABEL[plan.primaryZone] ?? plan.primaryZone
  const minutes = Math.round(plan.durationS / 60)
  const strength = plan.blocks.filter((b) => b.type === 'strength').length
  const what =
    strength === 0
      ? 'Mobilité seule.'
      : `Mobilité, puis ${strength} mouvement${strength > 1 ? 's' : ''} de renforcement.`
  const body = `${minutes} min pour ${zone === 'hanches' || zone === 'poignets' || zone === 'chevilles' ? 'les' : 'la'} ${zone}. ${what}`

  return {
    title: `Ta ${zone}.`,
    body: body.length > MAX_BODY ? `${minutes} min pour ${zone}.` : body,
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
