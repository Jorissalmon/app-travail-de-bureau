import { create } from 'zustand'
import { api, isOffline } from '@/lib/api'
import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { localDate } from '@/lib/date'
import { uuid } from '@/lib/uuid'
import type { ReminderKind, WorkSession } from '@/lib/types'
import {
  type Occurrence,
  allowedAt,
  dueBy,
  firstOccurrence,
  pendingAfter,
  planOccurrences,
  planResume,
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
 *  - the one reminder armed at a time, and the one that fired unanswered
 *  - the start/stop lifecycle and the notification-action handlers
 *  - the pause, whether the user asked for it or an exercise is on screen
 *
 * Only ever ONE reminder is scheduled ahead, where the engine used to lay down
 * an eight-hour grid. The grid meant a missed reminder was simply followed by
 * the next on time, and the day carried on without you. Arming one at a time
 * makes missing it stop the chain: nothing else fires until it is answered, and
 * the answer is asked for the moment the app is opened again.
 */

interface ActiveSession {
  id: string
  startedAt: string
  /** local start "HH:MM…" ISO, used to render the elapsed time. */
  localDate: string
  /** True until the server confirms; the id is a client uuid meanwhile. */
  synced: boolean
}

/**
 * 'manual' is the user stepping away and lasts until they come back; 'break'
 * lasts as long as an exercise is on screen. They are kept apart so that
 * closing a routine cannot silently restart a day the user meant to hold.
 */
export interface Pause {
  at: string
  reason: 'manual' | 'break'
  /**
   * What was left on the clock when the pause started, and for which reminder.
   * Resuming gives exactly that back rather than restarting a whole interval:
   * a meeting must not cost the twenty minutes already waited, nor hand you a
   * reminder the second you sit back down. Null when nothing was armed — a
   * quiet window, say — and the clock is simply replanned on resume.
   */
  heldMs?: number | null
  heldKind?: ReminderKind | null
}

/** A reminder that fired and has not been answered. Nothing is armed while it stands. */
export interface Awaiting {
  kind: ReminderKind
  firedAt: string
}

interface StoredState {
  session: ActiveSession | null
  occurrences: SerializableOcc[]
  pause?: Pause | null
  awaiting?: Awaiting | null
  /** Written by versions before the pause had a reason; read once, then dropped. */
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
  pause: Pause | null
  awaiting: Awaiting | null
  /**
   * The prompt was closed without answering. Not persisted and reset by every
   * catchUp, so it holds until the app next comes to the foreground and no
   * further: closing it buys quiet for now, it does not settle the exercise.
   */
  promptDismissed: boolean
  dismissPrompt: () => void
  ready: boolean
  /** Load persisted session on boot. */
  hydrate: () => Promise<void>
  start: () => Promise<void>
  stop: (opts?: { via?: 'button' | 'notification' }) => Promise<void>
  /**
   * Look at the clock: pick up a reminder that fired while the app was not
   * running, and arm one if nothing is. Called on boot and on every foreground.
   */
  catchUp: () => Promise<void>
  /** The user is stepping away from the desk. */
  pauseWork: () => Promise<void>
  resumeWork: () => Promise<void>
  /** Stop the clock while an exercise is on screen. */
  pauseForBreak: () => Promise<void>
  /**
   * A routine was carried through to the end. Whatever exercise was owed counts
   * as answered — including one opened from the library rather than the alert.
   */
  routineDone: () => Promise<void>
  /** Start the clock again once the exercise is over. */
  resumeFromBreak: () => Promise<void>
  /**
   * Record that a reminder of this kind is owed, whatever the app was doing.
   * Reached by a notification tap and by a launch from the lock screen.
   */
  noteAwaiting: (kind: ReminderKind) => Promise<void>
  /** Notification action handlers (§8.4). */
  markDone: (firedAt: Date) => Promise<void>
  snooze: (firedAt: Date) => Promise<void>
}

/** Past this, a break pause is taken as abandoned rather than in progress. */
const STALE_BREAK_MS = 20 * 60_000

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
  pause: Pause | null = null,
  awaiting: Awaiting | null = null,
): Promise<void> {
  const state: StoredState = { session, occurrences: serialize(occurrences), pause, awaiting }
  await setJSON(KEYS.session, state)
}

/**
 * Replace whatever is scheduled with the single next reminder due after `from`.
 * Returns what ended up armed, which is nothing when the rest of the horizon
 * falls in a quiet window or on a day the user excluded.
 */
async function armFrom(sessionId: string, from: Date): Promise<Occurrence[]> {
  const settings = useSettingsStore.getState().settings
  const next = firstOccurrence(planOccurrences({ sessionId, from, settings }))
  await cancelAll()
  if (!next) return []
  await scheduleAll([next], scheduleContext())
  return [next]
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  occurrences: [],
  pause: null,
  awaiting: null,
  promptDismissed: false,
  ready: false,

  dismissPrompt: () => set({ promptDismissed: true }),

  hydrate: async () => {
    const stored = await getJSON<StoredState | null>(KEYS.session, null)
    if (!stored?.session) {
      set({ ready: true })
      return
    }
    set({
      session: stored.session,
      occurrences: deserialize(stored.occurrences),
      // A device updating over the air carries the older shape, where a pause
      // was a bare instant and only ever meant an exercise was on screen.
      pause: stored.pause ?? (stored.pausedAt ? { at: stored.pausedAt, reason: 'break' } : null),
      awaiting: stored.awaiting ?? null,
      ready: true,
    })
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

    const occurrences = await armFrom(id, now)
    set({ session, occurrences, pause: null, awaiting: null })
    await persist(session, occurrences)

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
    set({ session: null, occurrences: [], pause: null, awaiting: null })
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

  catchUp: async () => {
    const { session, occurrences, awaiting } = get()
    let { pause } = get()
    // Every look at the clock puts the prompt back in front. This is the whole
    // of "closed, but it comes back".
    set({ promptDismissed: false })
    if (!session) return
    const now = new Date()

    // A break pause ends when the exercise screen is left, but the app can be
    // killed while it is open and then the day would never restart. No routine
    // runs this long, so a stale one is treated as over. A manual pause is the
    // user's decision and never expires.
    if (pause?.reason === 'break' && now.getTime() - Date.parse(pause.at) > STALE_BREAK_MS) {
      pause = null
      set({ pause: null })
    }
    if (pause) return

    // Already holding an unanswered reminder: nothing to arm, and the caller
    // routes to it. This is the state a missed notification leaves behind.
    if (awaiting) return

    const missed = dueBy(occurrences, now)
    if (missed) {
      // It fired while the app was not looking. Freeze here rather than arming
      // the next one: the day should not move on without the exercise.
      await cancelAll()
      const next: Awaiting = { kind: missed.kind, firedAt: missed.at.toISOString() }
      await logEvent(
        makeEvent({
          kind: missed.kind,
          action: 'expired',
          sessionId: session.id,
          firedAt: missed.at,
        }),
      )
      set({ occurrences: [], awaiting: next })
      await persist(session, [], null, next)
      return
    }

    // Nothing armed and nothing pending — after a reboot, say, or once a quiet
    // window has passed. Not gated on the platform: scheduling is a no-op in a
    // browser, and the countdown should still behave the same there.
    if (pendingAfter(occurrences, now).length === 0) {
      const armed = await armFrom(session.id, now)
      set({ occurrences: armed })
      await persist(session, armed)
    }
  },

  pauseWork: async () => {
    const { session, pause, awaiting, occurrences } = get()
    if (!session || pause) return
    const now = new Date()
    await cancelAll()

    // Freeze what was left rather than the wall-clock instant: the day resumes
    // where it stopped. An exercise already owed is held too — a meeting
    // landing at the wrong moment must not make it disappear.
    const armed = firstOccurrence(pendingAfter(occurrences, now))
    const next: Pause = {
      at: now.toISOString(),
      reason: 'manual',
      heldMs: armed ? Math.max(0, armed.at.getTime() - now.getTime()) : null,
      heldKind: armed?.kind ?? null,
    }
    set({ occurrences: [], pause: next })
    await persist(session, [], next, awaiting)
  },

  resumeWork: async () => {
    const { session, pause } = get()
    if (!session || pause?.reason !== 'manual') return
    const now = new Date()

    // The time held can land somewhere a reminder may not: a pause across
    // lunch, or into the evening. Fall back to a fresh plan rather than firing
    // inside a window the user excluded.
    const settings = useSettingsStore.getState().settings
    const held =
      pause.heldMs != null && pause.heldKind
        ? new Date(now.getTime() + pause.heldMs)
        : null
    let armed: Occurrence[]
    if (held && pause.heldKind && allowedAt(held, settings)) {
      armed = [planResume(session.id, pause.heldKind, held)]
      await cancelAll()
      await scheduleAll(armed, scheduleContext())
    } else {
      armed = await armFrom(session.id, now)
    }

    // Coming back to the desk puts an exercise held by the pause back in front.
    set({ occurrences: armed, pause: null, promptDismissed: false })
    await persist(session, armed, null, get().awaiting)
  },

  pauseForBreak: async () => {
    const { session, pause, awaiting } = get()
    // A manual pause outranks this one and must survive the exercise.
    if (!session || pause) return
    const now = new Date()
    await cancelAll()
    const armed = firstOccurrence(pendingAfter(get().occurrences, now))
    const next: Pause = {
      at: now.toISOString(),
      reason: 'break',
      heldMs: armed ? Math.max(0, armed.at.getTime() - now.getTime()) : null,
      heldKind: armed?.kind ?? null,
    }
    // An owed exercise is NOT cleared by merely putting it on screen. Walking
    // away from the page leaves it owed, and the app asks again next time —
    // which is the whole point of noticing the reminder was missed.
    set({ occurrences: [], pause: next })
    await persist(session, [], next, awaiting)
  },

  noteAwaiting: async (kind) => {
    const { session, awaiting, pause } = get()
    if (!session || awaiting) return
    await cancelAll()
    const next: Awaiting = { kind, firedAt: new Date().toISOString() }
    set({ occurrences: [], awaiting: next, promptDismissed: false })
    await persist(session, [], pause, next)
  },

  routineDone: async () => {
    const { session, awaiting, occurrences, pause } = get()
    if (!session || !awaiting) return
    set({ awaiting: null })
    await persist(session, occurrences, pause, null)
  },

  resumeFromBreak: async () => {
    const { session, pause, occurrences } = get()
    if (!session || pause?.reason !== 'break') return
    const now = new Date()
    // Armed from now, not from the start of the break: the point of the pause
    // is that the next reminder is due an interval after the exercise.
    const armed = await armFrom(session.id, now)
    // A "+10 min" taken during the pause is already in state and must survive;
    // whichever of the two comes first is the one that stays armed.
    const kept = pendingAfter(occurrences, now)
    const soonest = firstOccurrence([...armed, ...kept])
    const next = soonest ? [soonest] : []
    await cancelAll()
    await scheduleAll(next, scheduleContext())
    // The pause lifts, but an exercise still owed does not: leaving the alert
    // page without answering has to survive a restart.
    set({ occurrences: next, pause: null })
    await persist(session, next, null, get().awaiting)
  },

  markDone: async (firedAt) => {
    const { session, awaiting } = get()
    await logEvent(
      makeEvent({
        kind: awaiting?.kind ?? 'stand',
        action: 'done',
        sessionId: session?.id ?? null,
        firedAt,
      }),
    )
    if (!session) return
    // Answering releases the hold and starts the clock again. The pause is left
    // as it is: this runs from the player, where the break is still on screen.
    const armed = await armFrom(session.id, new Date())
    set({ occurrences: armed, awaiting: null })
    await persist(session, armed, get().pause, null)
  },

  snooze: async (firedAt) => {
    const { session, awaiting } = get()
    if (!session) return
    await logEvent(
      makeEvent({
        kind: awaiting?.kind ?? 'stand',
        action: 'snoozed',
        sessionId: session.id,
        firedAt,
      }),
    )
    // The only thing armed becomes the reminder in ten minutes: putting one off
    // must not let the one after it arrive first.
    const occ = planSnooze(session.id, new Date())
    await cancelAll()
    await scheduleOne(occ, scheduleContext())
    set({ occurrences: [occ], awaiting: null })
    await persist(session, [occ], get().pause, null)
  },
}))
