import type { Settings } from './types'

/** Mirrors the DB defaults in 001_init.sql, used before /api/me first answers. */
export const DEFAULT_SETTINGS: Settings = {
  intervalMin: 30,
  breakMinutes: 3,
  eyeReminders: false,
  mobilityTimes: ['10:30', '15:30'],
  quietStart: null,
  quietEnd: null,
  weekdays: [1, 2, 3, 4, 5],
  autoStartAt: null,
  sound: false,
  vibrate: true,
}

/** Interval choices offered in Settings (§11.6); 30 is recommended. */
export const INTERVAL_CHOICES = [15, 20, 25, 30, 45, 60] as const
export const RECOMMENDED_INTERVAL = 30
