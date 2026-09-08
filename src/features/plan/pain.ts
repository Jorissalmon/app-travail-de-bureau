import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { localDate } from '@/lib/date'
import { uuid } from '@/lib/uuid'
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
    at: at.toISOString(),
    localDate: localDate(at),
    zone: input.zone,
    score: Math.max(0, Math.min(10, Math.round(input.score))),
    source: input.source,
    ...(input.routineSlug ? { routineSlug: input.routineSlug } : {}),
  }
  entries = [...entries, entry].slice(-MAX_ENTRIES)
  await setJSON(KEYS.painJournal, entries)
  return entry
}

/** Used by the profile screen when someone clears their history. */
export async function clearPain(): Promise<void> {
  entries = []
  await setJSON(KEYS.painJournal, entries)
}

/** A client id for the day a server copy of this journal exists. */
export function painClientId(): string {
  return uuid()
}
