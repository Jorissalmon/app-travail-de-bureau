import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { api, isOffline } from '@/lib/api'
import { localDate } from '@/lib/date'
import { uuid } from '@/lib/uuid'
import { removeConfirmed } from '@/features/reminders/queue'
import type { PainEntry, PainScore, Zone } from '@/lib/types'

/**
 * The pain journal: every 0-10 answer the person has given, in order.
 *
 * It is the whole pivot in one file. The app used to count what it had made
 * happen — stands, minutes, a response rate — and none of that answers the only
 * question someone with a sore neck has. This journal answers it, and it is the
 * one number the app is allowed to show as an outcome, because it is the one
 * number the user typed.
 *
 * Device-local, like the activity journal and for the same reasons: the screen
 * must draw offline, and for someone who never made an account this is the
 * whole record. It is deliberately NOT part of the synced preferences — a pain
 * history is not a setting, and /api/prefs replaces its object wholesale.
 */

/** Kept bounded: two per day per zone over a year is already generous. */
const MAX_ENTRIES = 2000

/** The window the plan reads to decide whether pain is moving. */
export const TREND_DAYS = 14

let entries: PainEntry[] = []
let loaded = false

export async function loadPain(): Promise<PainEntry[]> {
  entries = await getJSON<PainEntry[]>(KEYS.painJournal, [])
  loaded = true
  return entries
}

/** Everything recorded, oldest first. Empty until `loadPain` has run. */
export function painEntries(): PainEntry[] {
  return entries
}

export function painLoaded(): boolean {
  return loaded
}

export async function recordPain(input: {
  zone: Zone
  score: PainScore
  source: PainEntry['source']
  routineSlug?: string
  at?: Date
}): Promise<PainEntry> {
  const at = input.at ?? new Date()
  const entry: PainEntry = {
    clientId: uuid(),
    at: at.toISOString(),
    localDate: localDate(at),
    zone: input.zone,
    score: Math.max(0, Math.min(10, Math.round(input.score))),
    source: input.source,
    ...(input.routineSlug ? { routineSlug: input.routineSlug } : {}),
  }
  entries = [...entries, entry].slice(-MAX_ENTRIES)
  await setJSON(KEYS.painJournal, entries)
  await setJSON(KEYS.painQueue, [...(await queued()), entry])
  void flushPain()
  return entry
}

/**
 * The sync buffer, beside the journal — the same split as the activity journal
 * (features/reminders/events.ts). The journal is the record and is never
 * drained; the queue is emptied by a successful flush. Keeping the two apart is
 * what lets someone without an account, or offline, still see their own
 * history: the record does not depend on the network having worked.
 */
function queued(): Promise<PainEntry[]> {
  return getJSON<PainEntry[]>(KEYS.painQueue, [])
}

let flushing = false

/**
 * Push the queued ratings. Idempotent on `(user_id, client_id)` server-side, so
 * a replayed batch cannot duplicate an answer — which matters more here than
 * anywhere else in the app: a duplicated rating would silently reweight the
 * day mean the whole plan is dosed on.
 *
 * Silent on failure, like every other flush: no account and no network are the
 * normal case, not an error to report.
 */
export async function flushPain(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    const pending = await queued()
    if (pending.length === 0) return
    await api.post<{ inserted: number }>('/api/pain', pending)
    await setJSON(
      KEYS.painQueue,
      removeConfirmed(await queued(), pending.map((e) => e.clientId)),
    )
  } catch (e) {
    if (!isOffline(e)) console.warn('[pain] flush failed', e)
  } finally {
    flushing = false
  }
}

/**
 * Merge what the server holds into the local journal.
 *
 * Union by clientId rather than replace: the device may hold ratings the server
 * has never seen (offline, or given before the account existed), and a second
 * device holds ratings this one has not. Dropping either would lose an answer
 * somebody gave, which is the one thing this journal exists not to do.
 */
export async function pullPain(): Promise<void> {
  try {
    const remote = await api.get<PainEntry[]>('/api/pain')
    if (!Array.isArray(remote)) return
    const byId = new Map(entries.map((e) => [e.clientId, e]))
    for (const e of remote) if (e?.clientId) byId.set(e.clientId, e)
    entries = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_ENTRIES)
    await setJSON(KEYS.painJournal, entries)
  } catch {
    // No account, offline, or an old build of the API: the device's own
    // journal stands, and it is the whole record for anyone who never signed up.
  }
}

/** Used by the profile screen when someone clears their history. */
export async function clearPain(): Promise<void> {
  entries = []
  await setJSON(KEYS.painJournal, entries)
  await setJSON(KEYS.painQueue, [])
}
