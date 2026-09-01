/** Shared domain types. Mirrors db/001_init.sql — keep the two in step. */

export type Zone = 'general' | 'hanches' | 'lombaires' | 'nuque' | 'dos' | 'yeux'

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

export interface Stats {
  standsToday: number
  remindersToday: number
  standsByDay: { localDate: string; stands: number; reminders: number }[]
  streak: number
  minutesMoved: number
  /** Share of reminders acted on over the last 30 days, 0..1, or null if none. */
  adherence: number | null
}

export interface ApiError {
  error: { code: string; message: string }
}
