import { api, isOffline } from '@/lib/api'
import { KEYS, getRaw, removeQuietly, setRawQuietly, watchStorage } from '@/lib/storage'
import { isNative } from '@/lib/platform'

/**
 * The preferences that follow the account rather than the phone.
 *
 * Three things the user decides and that used to stay on the device they were
 * decided on: routines they composed, per-step durations, the timer's cues.
 * Signing in on the web therefore showed an empty account, which reads as lost
 * data rather than as a design choice — and it was a design choice, made to
 * avoid a migration.
 *
 * What deliberately does NOT sync, and why: where you are working, and the
 * alarm's mode and volume. Those describe the device, not the person. A phone
 * carried into an open space must be able to stay silent while the laptop at
 * home rings, and « au bureau » must not follow you home at six o'clock.
 *
 * The wire format is the device's own storage, key by key, as strings. Nothing
 * is translated, nothing is versioned, and a preference added later is carried
 * by adding its key to SYNCED_KEYS.
 */

export const SYNCED_KEYS: readonly string[] = [
  KEYS.customRoutines,
  KEYS.stepDurations,
  KEYS.playerSound,
]

interface PrefsPayload {
  data: Record<string, string>
  updatedAt: string
}

/** How long a burst of edits is allowed to settle before one request goes out. */
const PUSH_DEBOUNCE_MS = 1200

let applyLocally: (() => Promise<void>) | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
let installed = false
let enabled = false

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

async function localStamp(): Promise<string> {
  return (await getRaw(KEYS.prefsUpdatedAt)) ?? new Date(0).toISOString()
}

async function stampNow(): Promise<void> {
  await setRawQuietly(KEYS.prefsUpdatedAt, new Date().toISOString())
}

async function readLocal(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const key of SYNCED_KEYS) {
    const value = await getRaw(key)
    if (value !== null) out[key] = value
  }
  return out
}

// ---------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------

interface Slugged {
  slug?: unknown
}

/**
 * Routines are unioned by slug rather than replaced, and every other key takes
 * the newer side whole.
 *
 * The case this exists for: someone builds routines on a phone with no account
 * — which the app now encourages — then signs in to an account that already
 * synced from a laptop. Newer-wins alone would delete work that was never
 * anywhere else. Slugs are random, so a union invents no conflict.
 */
function mergeRoutines(mine: string | undefined, theirs: string | undefined): string | undefined {
  const parse = (raw: string | undefined): Slugged[] => {
    if (!raw) return []
    try {
      const v: unknown = JSON.parse(raw)
      return Array.isArray(v) ? (v as Slugged[]) : []
    } catch {
      return []
    }
  }
  const a = parse(theirs)
  const b = parse(mine)
  if (a.length === 0 && b.length === 0) return mine ?? theirs
  const bySlug = new Map<string, Slugged>()
  for (const r of [...a, ...b]) {
    if (typeof r?.slug === 'string') bySlug.set(r.slug, r)
  }
  return JSON.stringify([...bySlug.values()])
}

/** What the device should hold, given its copy and the server's. */
export function merge(
  mine: Record<string, string>,
  theirs: Record<string, string>,
  serverIsNewer: boolean,
): Record<string, string> {
  const winner = serverIsNewer ? theirs : mine
  const next: Record<string, string> = {}
  for (const key of SYNCED_KEYS) {
    if (key === KEYS.customRoutines) {
      const merged = mergeRoutines(mine[key], theirs[key])
      if (merged !== undefined) next[key] = merged
      continue
    }
    const value = winner[key] ?? mine[key] ?? theirs[key]
    if (value !== undefined) next[key] = value
  }
  return next
}

// ---------------------------------------------------------------------------
// The two directions
// ---------------------------------------------------------------------------

async function push(): Promise<void> {
  if (!enabled) return
  const data = await readLocal()
  const res = await api.put<PrefsPayload>('/api/prefs', { data })
  await setRawQuietly(KEYS.prefsUpdatedAt, res.updatedAt)
}

function schedulePush(): void {
  if (!enabled) return
  if (pushTimer !== null) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void push().catch((e) => {
      // Offline is the normal case, and the next change or the next boot will
      // carry everything: the blob is whole every time, so nothing queues up.
      if (!isOffline(e)) console.warn('[prefs] push refusé', e)
    })
  }, PUSH_DEBOUNCE_MS)
}

/**
 * Reconcile with the server, in whichever direction is behind. Safe to call as
 * often as you like: on boot, after signing in, and every time the app comes
 * back to the foreground, which is what makes two devices agree without either
 * one being told to refresh.
 */
export async function syncPrefs(): Promise<void> {
  if (!enabled) return
  const [mine, mineAt] = await Promise.all([readLocal(), localStamp()])
  const theirs = await api.get<PrefsPayload>('/api/prefs')

  const serverIsNewer = new Date(theirs.updatedAt).getTime() > new Date(mineAt).getTime()
  const next = merge(mine, theirs.data, serverIsNewer)

  const changedLocally = SYNCED_KEYS.some((k) => next[k] !== mine[k])
  if (changedLocally) {
    for (const key of SYNCED_KEYS) {
      const value = next[key]
      if (value === undefined) await removeQuietly(key)
      else await setRawQuietly(key, value)
    }
    await applyLocally?.()
  }

  // The device holds something the server does not: either it was ahead, or the
  // merge produced a third thing that belongs to neither side.
  const changedRemotely = SYNCED_KEYS.some((k) => next[k] !== theirs.data[k])
  if (changedRemotely) await push()
  else await setRawQuietly(KEYS.prefsUpdatedAt, theirs.updatedAt)
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/**
 * Watch device storage and push what changes. Installed once, at boot, before
 * anyone is signed in — `enable` is what decides whether anything leaves the
 * device, so signing out stops the sync without tearing the watcher down.
 */
export function installPrefsSync(reload: () => Promise<void>): void {
  applyLocally = reload
  if (installed) return
  installed = true
  watchStorage((key) => {
    if (!SYNCED_KEYS.includes(key)) return
    void stampNow().then(schedulePush)
  })

  // Coming back to a tab is the browser's version of coming back to the app.
  // The native side is covered by appStateChange, which the reminder listeners
  // install — and which they only install on a device, so without this the web
  // half of « les deux doivent être synchro » never reconciled after boot.
  if (!isNative() && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      void syncPrefs().catch(() => {
        /* Offline, or signed out. */
      })
    })
  }
}

/** Signed in: the sync may talk to the server. */
export function enablePrefsSync(): void {
  enabled = true
}

/**
 * Signed out. The device keeps its preferences — they are still the user's —
 * but nothing is sent, and the stamp goes so the next account starts from a
 * clean comparison rather than from this one's clock.
 */
export async function disablePrefsSync(): Promise<void> {
  enabled = false
  if (pushTimer !== null) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  await removeQuietly(KEYS.prefsUpdatedAt)
}
