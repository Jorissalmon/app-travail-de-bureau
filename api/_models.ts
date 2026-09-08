import type { Row } from './_db.js'

/**
 * Row → public DTO mappers. Every user object that leaves the API goes through
 * toPublicUser, so password_hash can never be serialised (§6).
 */

export interface PublicUser {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export function toPublicUser(row: Row): PublicUser {
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    createdAt: (row.created_at as Date | string).toString(),
  }
}

export interface SettingsDTO {
  intervalMin: number
  breakMinutes: number
  eyeReminders: boolean
  mobilityTimes: string[]
  quietStart: string | null
  quietEnd: string | null
  weekdays: number[]
  autoStartAt: string | null
  sound: boolean
  vibrate: boolean
}

/** "10:30:00" → "10:30". Postgres time comes back with seconds. */
function hhmm(t: unknown): string | null {
  if (t == null) return null
  const s = String(t)
  return s.slice(0, 5)
}

export function toSettings(row: Row): SettingsDTO {
  return {
    intervalMin: Number(row.interval_min),
    breakMinutes: Number(row.break_minutes),
    eyeReminders: Boolean(row.eye_reminders),
    mobilityTimes: ((row.mobility_times as string[] | null) ?? []).map((t) => t.slice(0, 5)),
    quietStart: hhmm(row.quiet_start),
    quietEnd: hhmm(row.quiet_end),
    weekdays: ((row.weekdays as number[] | null) ?? []).map(Number),
    autoStartAt: hhmm(row.auto_start_at),
    sound: Boolean(row.sound),
    vibrate: Boolean(row.vibrate),
  }
}
