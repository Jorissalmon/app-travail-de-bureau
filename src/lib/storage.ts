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
  eventQueue: 'events.queue',
  completionQueue: 'completions.queue',
  routines: 'content.routines',
  articles: 'content.articles',
  scheduled: 'reminders.scheduled',
  playerSound: 'player.sound',
  bundleVersion: 'ota.bundleVersion',
  pendingNativeUpdate: 'ota.pendingNativeUpdate',
} as const

export async function getRaw(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key })
  return value ?? null
}

export async function setRaw(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value })
}

export async function remove(key: string): Promise<void> {
  await Preferences.remove({ key })
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
