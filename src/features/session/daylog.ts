import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { daysBetween } from '@/lib/date'

/**
 * The device's own record of the days it has worked: when each began, when it
 * ended.
 *
 * The server has this in work_sessions, and for someone signed in that is what
 * the journal is built from. But the journal has to read for someone who never
 * made an account too — the whole point of the local-first tracking — and the
 * event journal alone cannot say what time a day started or how long it ran.
 *
 * Same shape and same lifetime as the other journals: forty-five days, trimmed
 * on write, never drained by a sync.
 */

export interface DayLogEntry {
  startedAt: string
  endedAt: string | null
  localDate: string
}

const KEEP_DAYS = 45

async function read(): Promise<DayLogEntry[]> {
  return getJSON<DayLogEntry[]>(KEYS.dayLog, [])
}

function trim(entries: DayLogEntry[], today: string): DayLogEntry[] {
  return entries.filter((e) => daysBetween(e.localDate, today) <= KEEP_DAYS)
}

export async function readDayLog(): Promise<DayLogEntry[]> {
  return read()
}

/** A day began. Replaces an entry already open for the same start instant, so
    adopting a day started on another device cannot record it twice. */
export async function logDayStart(startedAt: string, localDate: string): Promise<void> {
  const entries = await read()
  if (entries.some((e) => e.startedAt === startedAt)) return
  const next = trim([...entries, { startedAt, endedAt: null, localDate }], localDate)
  await setJSON(KEYS.dayLog, next)
}

/** A day ended. Closes the most recent open entry; writes nothing if none is. */
export async function logDayEnd(endedAt: string, localDate: string): Promise<void> {
  const entries = await read()
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.endedAt === null) {
      entries[i] = { ...entries[i]!, endedAt }
      await setJSON(KEYS.dayLog, trim(entries, localDate))
      return
    }
  }
}
