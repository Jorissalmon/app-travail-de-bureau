import { Preferences } from '@capacitor/preferences'

/**
 * Persistent key/value storage.
 *
 * Uses @capacitor/preferences rather than localStorage: on Android the webview
 * storage can be purged by the system, and the refresh token must survive that
 * (§7). On the web the plugin falls back to localStorage, which is fine for dev.
 */

export const KEYS = {
  accessToken: 'auth.access',
  refreshToken: 'auth.refresh',
  user: 'auth.user',
  settings: 'settings',
  session: 'session.active',
  /** A day that outlived itself and still owes an answer about when it ended. */
  dayClose: 'session.pendingClose',
  onboarded: 'onboarding.done',
  eventQueue: 'events.queue',
  completionQueue: 'completions.queue',
  /**
   * The journals: the same entries as the queues, but never drained by a sync.
   * They are what the tracking screen is computed from when the server has not
   * answered — offline, or because there is no account to answer for.
   */
  eventJournal: 'events.journal',
  completionJournal: 'completions.journal',
  /** When each day began and ended on this device, for the journal. */
  dayLog: 'session.dayLog',
  /** The device is deliberately being used without an account. */
  localOnly: 'auth.localOnly',
  routines: 'content.routines',
  articles: 'content.articles',
  exercises: 'content.exercises',
  scheduled: 'reminders.scheduled',
  playerSound: 'player.sound',
  alertMode: 'reminders.alertMode',
  alertVolume: 'reminders.alertVolume',
  place: 'place',
  /** What the first run collected: painful zones, how long, how many minutes. */
  painProfile: 'pain.profile',
  /** Every 0-10 answer ever given, oldest first. Never drained by a sync. */
  painJournal: 'pain.journal',
  /** The analytics ring buffer, see features/analytics. */
  analyticsJournal: 'analytics.journal',
  stepDurations: 'player.durations',
  customRoutines: 'routines.custom',
  /** When the synced preferences last changed on this device. */
  prefsUpdatedAt: 'prefs.updatedAt',
  bundleVersion: 'ota.bundleVersion',
  pendingNativeUpdate: 'ota.pendingNativeUpdate',
} as const

/**
 * Anyone who wants to know that a stored value changed.
 *
 * The preferences that follow the account — routines, durations, cues — are
 * each owned by their own module with their own load function, and none of them
 * knew anything about syncing. Rather than thread a push call through all of
 * them, the sync watches writes here: one place, and a preference added later
 * is carried without touching it.
 */
type Watcher = (key: string) => void
const watchers = new Set<Watcher>()

export function watchStorage(fn: Watcher): () => void {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

function announce(key: string): void {
  for (const fn of watchers) {
    try {
      fn(key)
    } catch {
      /* A watcher must never break the write it was told about. */
    }
  }
}

/**
 * Write without waking the watchers. Used by the sync when it applies what the
 * server sent: announcing those would push the same values straight back.
 */
export async function setRawQuietly(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value })
}

/** Delete without waking the watchers, for the same reason. */
export async function removeQuietly(key: string): Promise<void> {
  await Preferences.remove({ key })
}

export async function getRaw(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key })
  return value ?? null
}

export async function setRaw(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value })
  announce(key)
}

export async function remove(key: string): Promise<void> {
  await Preferences.remove({ key })
  announce(key)
}

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await getRaw(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    // A corrupted entry must never brick the app; drop it and move on.
    await remove(key)
    return fallback
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await setRaw(key, JSON.stringify(value))
}
