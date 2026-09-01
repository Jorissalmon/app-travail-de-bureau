import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { api, isOffline } from '@/lib/api'
import { localDate } from '@/lib/date'
import { uuid } from '@/lib/uuid'
import type { Completion, ReminderAction, ReminderEvent, ReminderKind } from '@/lib/types'
import { enqueueCompletions, enqueueEvents, removeConfirmed } from './queue'

/**
 * The offline-first event journal (§8.5). Every interaction is written to the
 * local queue first and never waits on the network; a flush runs opportunistically.
 */

export function makeEvent(params: {
  kind: ReminderKind
  action: ReminderAction
  sessionId: string | null
  firedAt: Date
  actedAt?: Date | null
  clientId?: string
}): ReminderEvent {
  return {
    clientId: params.clientId ?? uuid(),
    sessionId: params.sessionId,
    kind: params.kind,
    firedAt: params.firedAt.toISOString(),
    action: params.action,
    actedAt: (params.actedAt ?? new Date()).toISOString(),
    localDate: localDate(params.firedAt),
  }
}

export async function logEvent(event: ReminderEvent): Promise<void> {
  const queue = await getJSON<ReminderEvent[]>(KEYS.eventQueue, [])
  await setJSON(KEYS.eventQueue, enqueueEvents(queue, [event]))
  void flushEvents()
}

export async function logCompletion(c: Completion): Promise<void> {
  const queue = await getJSON<Completion[]>(KEYS.completionQueue, [])
  await setJSON(KEYS.completionQueue, enqueueCompletions(queue, [c]))
  void flushEvents()
}

let flushing = false

/** Push both queues to the server in batches; idempotent, safe to call often. */
export async function flushEvents(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    const events = await getJSON<ReminderEvent[]>(KEYS.eventQueue, [])
    if (events.length > 0) {
      try {
        await api.post<{ inserted: number }>('/api/events', events)
        const remaining = removeConfirmed(
          await getJSON<ReminderEvent[]>(KEYS.eventQueue, []),
          events.map((e) => e.clientId),
        )
        await setJSON(KEYS.eventQueue, remaining)
      } catch (e) {
        if (!isOffline(e)) throw e
      }
    }

    const completions = await getJSON<Completion[]>(KEYS.completionQueue, [])
    if (completions.length > 0) {
      try {
        await api.post('/api/completions', completions)
        const remaining = removeConfirmed(
          await getJSON<Completion[]>(KEYS.completionQueue, []),
          completions.map((c) => c.clientId),
        )
        await setJSON(KEYS.completionQueue, remaining)
      } catch (e) {
        if (!isOffline(e)) throw e
      }
    }
  } finally {
    flushing = false
  }
}
