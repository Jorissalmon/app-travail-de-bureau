/** Shared domain types. Mirrors db/001_init.sql — keep the two in step. */

export type Zone =
  | 'matin'
  | 'bureau'
  | 'nuque'
  | 'dos'
  | 'lombaires'
  | 'hanches'
  | 'poignets'
  | 'chevilles'
  | 'yeux'
  | 'bien-etre'

/** How the library is browsed (§11.2): by moment, by body part, by intent. */
export type Family = 'moment' | 'corps' | 'bien-etre'

export type AccentKey =
  | 'peach'
  | 'sage'
  | 'navy'
  | 'sky'
  | 'brick'
  | 'lime'
  | 'pine'
  | 'blush'
  | 'sun'
  | 'slate'

export type ReminderKind = 'stand' | 'eyes' | 'mobility'
export type ReminderAction = 'done' | 'snoozed' | 'dismissed' | 'expired'

export type EvidenceLevel = 'solide' | 'partielle' | 'non-demontree'
export type ArticleTag = 'preuve' | 'reglage' | 'pratique'

/**
 * What a movement is for. The pivot (§ coach douleur) needs the distinction:
 * mobility restores range, strength puts load on a muscle, reset does neither
 * and is there to close a session or slow the breath down. The adaptive plan
 * doses the three differently — mobility carries a painful zone, strength is
 * only introduced once the pain has actually come down, and a reset always
 * ends the session.
 */
export type ExerciseType = 'mobility' | 'strength' | 'reset'

/**
 * What a routine is trying to do, which is not the same as which zone it
 * touches. `pain_relief` is served to a zone that hurts today, `prevention` to
 * one that does not, `strength` only to someone whose reported pain is coming
 * down. Nothing here claims an effect: it is a composition rule, and the
 * article it points at says what the evidence actually supports.
 */
export type RoutineGoal = 'pain_relief' | 'prevention' | 'strength'

export interface User {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export interface Settings {
  intervalMin: number
  breakMinutes: number
  eyeReminders: boolean
  /** "HH:MM" local times at which a mobility routine is suggested. */
  mobilityTimes: string[]
  /** "HH:MM" or null. A window that may wrap past midnight. */
  quietStart: string | null
  quietEnd: string | null
  /** ISO weekdays, 1 = Monday. */
  weekdays: number[]
  autoStartAt: string | null
  sound: boolean
  vibrate: boolean
}

export interface WorkSession {
  id: string
  startedAt: string
  endedAt: string | null
  localDate: string
}

export interface RoutineStep {
  position: number
  name: string
  durationS: number
  cue: string
  figureKey: string
  /** Which entry of the exercise library explains this movement in full. */
  exerciseKey: string
}

/**
 * The full explanation of one movement (§ audit — "les exos doivent avoir une
 * page où on explique ce que c'est"). Keyed by `exerciseKey`, not by routine
 * step: the same movement recurs across routines (a lunge is a lunge whether
 * it opens "Debout" or closes "Réveil"), so it is documented once and every
 * step that uses it points at the same entry.
 */
export interface Exercise {
  key: string
  title: string
  /** Numbered how-to, read top to bottom. */
  steps: string[]
  tips: string[]
  /** One way to make it more accessible — a beginner always has exactly one. */
  easier: string
  /** Body parts or systems it works, shown as chips. */
  muscles: string[]
  /** The one thing that means "stop", plain enough for someone who has never done it. */
  avoid: string
  /** Article slugs that explain why this movement is worth the time. */
  articles: string[]
  /** Doable at a desk in an open space without drawing looks. */
  discreet: boolean
  /** Mobility, strength or reset — what the adaptive plan doses on. */
  type: ExerciseType
}

export interface Routine {
  id: string
  slug: string
  title: string
  zone: Zone
  durationS: number
  summary: string
  accent: AccentKey
  sortOrder: number
  /** What it is composed for. See RoutineGoal. */
  goal: RoutineGoal
  /**
   * The body zones it actually works, which the browse zone does not always
   * say: « Debout » lives under `bureau` and works the hips, the upper back
   * and the calves. This is what the plan matches a painful zone against.
   */
  targetZones: Zone[]
  steps: RoutineStep[]
}

export interface Article {
  id: string
  slug: string
  title: string
  dek: string
  bodyMd: string
  tag: ArticleTag
  evidence: EvidenceLevel
  readMin: number
  sourceLabel: string
  sourceUrl: string
  sortOrder: number
}

/** One reminder that fired on the device, queued locally then flushed in batch. */
export interface ReminderEvent {
  clientId: string
  sessionId: string | null
  kind: ReminderKind
  firedAt: string
  action: ReminderAction
  actedAt: string | null
  localDate: string
}

export interface Completion {
  clientId: string
  routineId: string | null
  routineSlug: string
  completedAt: string
  durationS: number
  localDate: string
}

/** One line of the activity journal. See features/session/journal.ts. */
export type JournalEntryKind = 'start' | 'end' | 'moved' | 'snoozed' | 'missed' | 'stood'

export interface JournalEntry {
  /** ISO instant, what the line is sorted by. */
  at: string
  kind: JournalEntryKind
  /** For a movement break: which routine. The title is resolved by the screen,
      from the catalogue, so a renamed routine renames its history too. */
  routineSlug?: string
  durationS?: number
}

export interface JournalDay {
  localDate: string
  /** Seconds between starting the day and ending it, summed over the day's
      sessions. An open one counts up to now. */
  workedS: number
  /** Seconds spent in routines carried to the end. */
  movedS: number
  /** Worked minus moved: the time actually spent at the desk, on the work. */
  focusS: number
  stands: number
  reminders: number
  /** A day still running. */
  open: boolean
  entries: JournalEntry[]
}

export interface Stats {
  standsToday: number
  remindersToday: number
  standsByDay: { localDate: string; stands: number; reminders: number }[]
  streak: number
  minutesMoved: number
  /** Share of reminders acted on over the last 30 days, 0..1, or null if none. */
  adherence: number | null
  /** Day by day, newest first: what happened and how long it took. */
  journal: JournalDay[]
}

/**
 * ---------------------------------------------------------------------------
 * Coach douleur — the adaptive plan (§ pivot)
 * ---------------------------------------------------------------------------
 * The app used to fire a timer and serve a fixed routine. It now composes a
 * session from what the person reported hurting, and re-composes it as that
 * report changes. Everything below is what that needs, and nothing more: no
 * score, no index, no estimated benefit. A number here was either typed by the
 * user or counted from what they did.
 */

/**
 * A pain rating, 0 to 10, as the person typed it on a slider. Not a
 * measurement and not a diagnosis — the app never converts it into anything
 * else, and never claims it means more than "what you answered that day".
 */
export type PainScore = number

/** One zone rated at one moment. Device-local, like the activity journal. */
export interface PainEntry {
  /** Generated on the device, so a replayed sync cannot duplicate a rating. */
  clientId: string
  /** ISO instant the rating was given. */
  at: string
  localDate: string
  zone: Zone
  score: PainScore
  /**
   * Where the rating came from: the first-run questionnaire, the mandatory
   * question at the end of a session, or a manual edit. Kept so a before/after
   * delta is never computed across two different kinds of moment.
   */
  source: 'onboarding' | 'post-session' | 'manual'
  /** For a post-session rating: the plan or routine that had just been done. */
  routineSlug?: string
}

/** How long the pain has been there, asked once at first run. */
export type PainDuration = 'moins-1-mois' | '1-6-mois' | 'plus-6-mois'

/** How much time the person is willing to give per day. */
export type PlanMinutes = 4 | 6 | 8

/** What the first run collected, and what the profile screen can change. */
export interface PainProfile {
  /** Zones declared painful at first run, most painful first. */
  zones: Zone[]
  /** The first-run rating per zone, 0..10. Only zones in `zones` appear. */
  baseline: Partial<Record<Zone, PainScore>>
  since: PainDuration | null
  minutes: PlanMinutes
  /** ISO instant the profile was first completed. */
  startedAt: string
}

/** One movement in a composed session. Same shape as a routine step, plus why. */
export interface PlanBlock extends RoutineStep {
  /** Which of the three the block is, so the screen can say what it is doing. */
  type: ExerciseType
  /** The zone this block was picked for, or null for an opener/closer. */
  forZone: Zone | null
}

/**
 * The session the app proposes today. Rebuilt, not stored: it is a pure
 * function of the profile, the pain journal and the date, so two devices with
 * the same history propose the same thing and a bug is reproducible.
 */
export interface AdaptivePlan {
  /** Stable within a day: "plan-2026-09-08". */
  id: string
  localDate: string
  /** Exactly the sum of the blocks. */
  durationS: number
  goal: RoutineGoal
  /** Ordered, most painful zone first. At most two. */
  targetZones: Zone[]
  /** The zone the closing question asks about. Null when nothing was declared. */
  primaryZone: Zone | null
  blocks: PlanBlock[]
  /** One factual line saying why this composition, shown on the card. */
  rationale: string
}

export interface ApiError {
  error: { code: string; message: string }
}
