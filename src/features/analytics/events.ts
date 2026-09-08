import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { localDate } from '@/lib/date'
import type { PlanMinutes, RoutineGoal, Zone } from '@/lib/types'
import type { Place } from '@/features/place/place'

/**
 * The events the pivot has to be judged on, and nothing else.
 *
 * Four numbers decide whether this was worth doing: D30 retention on the
 * « douleur ≥ 3/10 » cohort, the change in reported pain between day 0 and day
 * 14, session completion rate, and no regression on the content doctrine. This
 * file is the minimum set of events those four can be computed from — every
 * event below maps to one of them in docs/VALIDATION-PIVOT.md, and an event
 * that maps to none of them does not belong here.
 *
 * Three rules, which are the doctrine applied to measurement:
 *
 * 1. **No third-party SDK.** Nothing here loads a script, opens a socket or
 *    talks to an analytics vendor. Events land in a device-local ring buffer
 *    and go to the app's own API, or nowhere. An app whose pitch is « on ne
 *    t'invente pas de chiffres » cannot ship a tracker that sells them.
 * 2. **No free text, ever.** Every payload below is a closed vocabulary or a
 *    number. A pain score is a number the user typed; a zone is one of ten
 *    known strings. Nothing a person writes is collected, because nothing a
 *    person writes is needed for the four numbers above.
 * 3. **Counted, not estimated.** `session_completed` fires when the last block
 *    ended, not when the app guesses someone probably finished.
 */

export type AnalyticsEvent =
  /** First run reached, before any question. Denominator of the funnel. */
  | { name: 'onboarding_started' }
  /** One first-run question answered. `step` is the screen, not the answer. */
  | { name: 'onboarding_step'; step: 'zones' | 'since' | 'place' | 'minutes' | 'plan' }
  /**
   * First run finished. `seconds` is wall-clock from `onboarding_started`: the
   * « premier plan en moins de 90 secondes » target is checked on this and on
   * nothing else.
   */
  | {
      name: 'onboarding_completed'
      seconds: number
      zones: number
      maxPain: number
      minutes: PlanMinutes
      place: Place
    }
  /** The person left the first run without finishing. `step` is where. */
  | { name: 'onboarding_abandoned'; step: string }
  /** A plan was composed and shown. One per day per device at most. */
  | {
      name: 'plan_shown'
      goal: RoutineGoal
      zones: number
      strengthBlocks: number
      durationS: number
    }
  /** A session started. `source` says what made it start. */
  | {
      name: 'session_started'
      kind: 'plan' | 'routine'
      slug: string
      source: 'home' | 'notification' | 'library'
      durationS: number
    }
  /**
   * A session ran to its last block. Numerator of the completion rate;
   * `session_started` is the denominator.
   */
  | { name: 'session_completed'; kind: 'plan' | 'routine'; slug: string; durationS: number }
  /** A session was left before the end, and at which block. */
  | { name: 'session_abandoned'; kind: 'plan' | 'routine'; slug: string; atBlock: number }
  /**
   * The mandatory closing question was answered. This is the pain series the
   * D0→D14 delta is computed from, and the only outcome the app reports.
   */
  | { name: 'pain_rated'; zone: Zone; score: number; source: 'onboarding' | 'post-session' | 'manual' }
  /** The closing question was dismissed without an answer. */
  | { name: 'pain_skipped'; zone: Zone }
  /** The plan changed what it serves, and why. Proves the adaptation is real. */
  | { name: 'plan_adapted'; zone: Zone; from: RoutineGoal; to: RoutineGoal; strengthBlocks: number }
  /** A contextual reminder fired, and what came of it. */
  | { name: 'reminder_acted'; kind: string; action: string }
  /**
   * A reminder went unanswered and the next one was pushed back. Watched
   * because the promise here is that the app backs off rather than nags: a
   * `misses` distribution with a long tail means it is still nagging.
   */
  | { name: 'reminder_backoff'; misses: number; nextInMin: number }
  /** A freeze was spent. Watched because a freeze that never fires is a lie. */
  | { name: 'streak_freeze_used'; left: number }
  /** The place changed: the discretion filter is the main cause of an empty plan. */
  | { name: 'place_changed'; place: Place }
  /** An article was opened from a movement sheet, with its evidence level. */
  | { name: 'article_opened'; slug: string; evidence: string; from: 'exercise' | 'list' | 'plan' }

export interface StoredEvent {
  at: string
  localDate: string
  event: AnalyticsEvent
}

/**
 * Kept small on purpose. This is a diagnostic buffer for a beta, not a
 * warehouse: enough to reconstruct a fortnight of one person's funnel, and
 * bounded so a device that never syncs cannot grow without limit.
 */
const MAX_EVENTS = 500

let buffer: StoredEvent[] = []
let loaded = false

export async function loadAnalytics(): Promise<void> {
  buffer = await getJSON<StoredEvent[]>(KEYS.analyticsJournal, [])
  loaded = true
}

export function analyticsEvents(): StoredEvent[] {
  return buffer
}

/**
 * Record one event. Never throws and never blocks the caller: an analytics
 * write that breaks a session is a worse bug than a missing data point.
 */
export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    if (!loaded) await loadAnalytics()
    const now = new Date()
    buffer = [...buffer, { at: now.toISOString(), localDate: localDate(now), event }].slice(
      -MAX_EVENTS,
    )
    await setJSON(KEYS.analyticsJournal, buffer)
  } catch {
    /* Measuring the app must never be able to break it. */
  }
}

/** Fire-and-forget, for call sites inside a render or an effect. */
export function trackNow(event: AnalyticsEvent): void {
  void track(event)
}

export async function clearAnalytics(): Promise<void> {
  buffer = []
  await setJSON(KEYS.analyticsJournal, buffer)
}
