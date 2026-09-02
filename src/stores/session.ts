import { create } from 'zustand'
import { api, isOffline } from '@/lib/api'
import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { localDate } from '@/lib/date'
import { uuid } from '@/lib/uuid'
import { isNative } from '@/lib/platform'
import type { WorkSession } from '@/lib/types'
import {
  type Occurrence,
  TOPUP_THRESHOLD,
  pendingAfter,
  planOccurrences,
  planSnooze,
} from '@/features/reminders/schedule'
import {
  cancelAll,
  ensureChannelAndActions,
  scheduleAll,
  scheduleOne,
  type ScheduleContext,
} from '@/features/reminders/notifications'
import {
  PermissionsMissingError,
  allGranted,
  readPermissions,
} from '@/features/reminders/permissions'
import { flushEvents, logEvent, makeEvent } from '@/features/reminders/events'
import { useSettingsStore } from './settings'

/**
 * The session store is the reminder engine's front door (§8). It owns:
 *  - the active work session (persisted so it survives an app restart)
 *  - the list of scheduled occurrences (to cancel and to top up)
 *  - the start/stop lifecycle and the notification-action handlers
 *  - the break pause: while an exercise is on screen the grid is stopped, so a
 *    second reminder cannot land on top of the one being done
 */

interface ActiveSession {
  id: string
  startedAt: string
  /** local start "HH:MM…" ISO, used to render the elapsed time. */
  localDate: string
  /** True until the server confirms; the id is a client uuid meanwhile. */
  synced: boolean
}

interface StoredState {
  session: ActiveSession | null
  occurrences: SerializableOcc[]
  pausedAt?: string | null
}

interface SerializableOcc {
  id: number
  kind: Occurrence['kind']
  at: string
  index: number
}

interface SessionState {
  session: ActiveSession | null
  occurrences: Occurrence[]
  /** ISO instant the grid was stopped for an exercise, or null while it runs. */
  pausedAt: string | null
  ready: boolean
  /** Load persisted session on boot. */
  hydrate: () => Promise<void>
  start: () => Promise<void>
  stop: (opts?: { via?: 'button' | 'notification' }) => Promise<void>
  /** Re-plan on foreground if running low (§8.2). */
  topUpIfNeeded: () => Promise<void>
  /** Stop the clock while an exercise is on screen. */
  pauseForBreak: () => Promise<void>
  /** Start the grid again from now, once the exercise is over. */
  resumeFromBreak: () => Promise<void>
  /** Notification action handlers (§8.4). */
  markDone: (firedAt: Date) => Promise<void>
  snooze: (firedAt: Date) => Promise<void>
}

function scheduleContext(): ScheduleContext {
  const { sound } = useSettingsStore.getState().settings
  return { sound }
}

function serialize(occ: Occurrence[]): SerializableOcc[] {
  return occ.map((o) => ({ id: o.id, kind: o.kind, at: o.at.toISOString(), index: o.index }))
}
function deserialize(occ: SerializableOcc[]): Occurrence[] {
  return occ.map((o) => ({ id: o.id, kind: o.kind, at: new Date(o.at), index: o.index }))
}

async function persist(
  session: ActiveSession | null,
  occurrences: Occurrence[],
  pausedAt: string | null = null,
): Promise<void> {
  const state: StoredState = { session, occurrences: serialize(occurrences), pausedAt }
  await setJSON(KEYS.session, state)
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  occurrences: [],
  pausedAt: null,
  ready: false,

  hydrate: async () => {
    const stored = await getJSON<StoredState | null>(KEYS.session, null)
    if (stored?.session) {
      set({
        session: stored.session,
        occurrences: deserialize(stored.occurrences),
        pausedAt: stored.pausedAt ?? null,
        ready: true,
      })
    } else {
      set({ ready: true })
    }
  },

  start: async () => {
    // A session whose reminders cannot fire is worse than no session: the user
    // believes they are covered. Refuse, and let the caller open the sheet.
    await ensureChannelAndActions()
    const permissions = await readPermissions()
    if (!allGranted(permissions)) throw new PermissionsMissingError(permissions)

    const now = new Date()
    const id = uuid()
    const session: ActiveSession = {
      id,
      startedAt: now.toISOString(),
      localDate: localDate(now),
      synced: false,
    }

    const settings = useSettingsStore.getState().settings
    const occurrences = planOccurrences({ sessionId: id, from: now, settings })

    set({ session, occurrences, pausedAt: null })
    await persist(session, occurrences)

    await scheduleAll(occurrences, scheduleContext())

    // Tell the server, best-effort. The local session is authoritative.
    try {
      const res = await api.post<{ session: WorkSession }>('/api/sessions', {
        action: 'start',
        at: session.startedAt,
        localDate: session.localDate,
      })
      const synced = { ...session, id: res.session.id, synced: true }
      // Keep local notification ids (they hash the *local* uuid) — do not
      // reschedule against the server id, or the pending ids would drift.
      set({ session: synced })
      await persist(synced, get().occurrences)
    } catch (e) {
      if (!isOffline(e)) throw e
    }
  },

  stop: async ({ via = 'button' } = {}) => {
    const { session } = get()
    await cancelAll()
    set({ session: null, occurrences: [], pausedAt: null })
    await persist(null, [])

    if (!session) return
    if (via === 'notification') {
      await logEvent(
        makeEvent({ kind: 'stand', action: 'dismissed', sessionId: session.id, firedAt: new Date() }),
      )
    }
    try {
      await api.post('/api/sessions', {
        action: 'stop',
        at: new Date().toISOString(),
        localDate: localDate(),
      })
    } catch (e) {
      if (!isOffline(e)) throw e
    }
    void flushEvents()
  },

  topUpIfNeeded: async () => {
    const { session, occurrences, pausedAt } = get()
    // A paused grid has nothing pending on purpose; topping it up would undo
    // the pause and fire a reminder in the middle of the exercise.
    if (!session || !isNative() || pausedAt) return
    const stillPending = pendingAfter(occurrences, new Date())
    if (stillPending.length >= TOPUP_THRESHOLD) return

    // Re-plan from now for a fresh horizon and reschedule.
    const settings = useSettingsStore.getState().settings
    const fresh = planOccurrences({ sessionId: session.id, from: new Date(), settings })
    await cancelAll()
    await scheduleAll(fresh, scheduleContext())
    set({ occurrences: fresh })
    await persist(session, fresh)
  },

  pauseForBreak: async () => {
    const { session, pausedAt } = get()
    if (!session || pausedAt) return
    await cancelAll()
    const at = new Date().toISOString()
    set({ occurrences: [], pausedAt: at })
    await persist(session, [], at)
  },

  resumeFromBreak: async () => {
    const { session, pausedAt, occurrences } = get()
    if (!session || !pausedAt) return
    const now = new Date()
    const settings = useSettingsStore.getState().settings
    // Re-planned from now, not from the start of the break: the point of the
    // pause is that the next reminder is due an interval after the exercise.
    const fresh = planOccurrences({ sessionId: session.id, from: now, settings })
    // A "+10 min" taken during the pause is already in state and must survive.
    const kept = pendingAfter(occurrences, now)
    const byId = new Map(fresh.map((o) => [o.id, o]))
    for (const o of kept) byId.set(o.id, o)
    const next = [...byId.values()].sort((a, b) => a.at.getTime() - b.at.getTime())

    await cancelAll()
    await scheduleAll(next, scheduleContext())
    set({ occurrences: next, pausedAt: null })
    await persist(session, next, null)
  },

  markDone: async (firedAt) => {
    const { session } = get()
    await logEvent(
      makeEvent({ kind: 'stand', action: 'done', sessionId: session?.id ?? null, firedAt }),
    )
  },

  snooze: async (firedAt) => {
    const { session, occurrences } = get()
    if (!session) return
    await logEvent(
      makeEvent({ kind: 'stand', action: 'snoozed', sessionId: session.id, firedAt }),
    )
    // A single extra occurrence at +10; the grid is untouched (§8.4).
    const occ = planSnooze(session.id, new Date())
    await scheduleOne(occ, scheduleContext())
    const next = [...occurrences, occ]
    set({ occurrences: next })
    await persist(session, next, get().pausedAt)
  },
}))
