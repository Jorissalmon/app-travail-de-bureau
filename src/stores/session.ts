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
  ready: boolean
  /** Load persisted session on boot. */
  hydrate: () => Promise<void>
  start: () => Promise<void>
  stop: (opts?: { via?: 'button' | 'notification' }) => Promise<void>
  /** Re-plan on foreground if running low (§8.2). */
  topUpIfNeeded: () => Promise<void>
  /** Notification action handlers (§8.4). */
  markDone: (firedAt: Date) => Promise<void>
  snooze: (firedAt: Date) => Promise<void>
}

function scheduleContext(): ScheduleContext {
  const { sound } = useSettingsStore.getState().settings
  return { sound, route: '/player/debout' }
}

function serialize(occ: Occurrence[]): SerializableOcc[] {
  return occ.map((o) => ({ id: o.id, kind: o.kind, at: o.at.toISOString(), index: o.index }))
}
function deserialize(occ: SerializableOcc[]): Occurrence[] {
  return occ.map((o) => ({ id: o.id, kind: o.kind, at: new Date(o.at), index: o.index }))
}

async function persist(session: ActiveSession | null, occurrences: Occurrence[]): Promise<void> {
  const state: StoredState = { session, occurrences: serialize(occurrences) }
  await setJSON(KEYS.session, state)
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  occurrences: [],
  ready: false,

  hydrate: async () => {
    const stored = await getJSON<StoredState | null>(KEYS.session, null)
    if (stored?.session) {
      set({ session: stored.session, occurrences: deserialize(stored.occurrences), ready: true })
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

    set({ session, occurrences })
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
    set({ session: null, occurrences: [] })
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
    const { session, occurrences } = get()
    if (!session || !isNative()) return
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
    await persist(session, next)
  },
}))
