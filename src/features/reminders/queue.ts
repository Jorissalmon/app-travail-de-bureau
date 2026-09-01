import type { Completion, ReminderEvent } from '@/lib/types'

/**
 * Offline event queue logic (§8.5). Pure functions over a plain array so the
 * dedup and cap rules are unit-tested; the storage side effects live in the
 * store. Every interaction writes here first and never waits on the server.
 */

/** Hard cap per the spec — oldest entries are dropped past this. */
export const QUEUE_CAP = 500

/**
 * Append events, drop duplicates by clientId (a replayed action must not
 * enqueue twice), and keep only the most recent QUEUE_CAP entries.
 */
export function enqueueEvents(
  queue: ReminderEvent[],
  incoming: ReminderEvent[],
): ReminderEvent[] {
  const seen = new Set(queue.map((e) => e.clientId))
  const merged = [...queue]
  for (const e of incoming) {
    if (seen.has(e.clientId)) {
      // Same clientId already queued: keep the later action (e.g. an event that
      // was 'expired' then acted on). Replace in place.
      const idx = merged.findIndex((q) => q.clientId === e.clientId)
      if (idx !== -1) merged[idx] = e
      continue
    }
    seen.add(e.clientId)
    merged.push(e)
  }
  return merged.length > QUEUE_CAP ? merged.slice(merged.length - QUEUE_CAP) : merged
}

export function enqueueCompletions(
  queue: Completion[],
  incoming: Completion[],
): Completion[] {
  const seen = new Set(queue.map((e) => e.clientId))
  const merged = [...queue]
  for (const c of incoming) {
    if (seen.has(c.clientId)) continue
    seen.add(c.clientId)
    merged.push(c)
  }
  return merged.length > QUEUE_CAP ? merged.slice(merged.length - QUEUE_CAP) : merged
}

/**
 * Remove the events the server confirmed. The server is idempotent, so we
 * remove by clientId regardless of whether it reported them as newly inserted
 * or already present.
 */
export function removeConfirmed<T extends { clientId: string }>(
  queue: T[],
  confirmedClientIds: string[],
): T[] {
  const done = new Set(confirmedClientIds)
  return queue.filter((e) => !done.has(e.clientId))
}
