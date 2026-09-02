import {
  LocalNotifications,
  type PendingResult,
  type ScheduleOptions,
} from '@capacitor/local-notifications'
import { isNative } from '@/lib/platform'
import type { Occurrence } from './schedule'
import type { ReminderKind } from '@/lib/types'

/**
 * Thin wrapper over @capacitor/local-notifications (§8). All scheduling is
 * local — the server never sends a push. On the web the plugin is a no-op, so
 * the app still runs in a browser for development.
 */

export const CHANNEL_ID = 'releve_breaks'
export const ACTION_TYPE = 'RELEVE_BREAK'

/** Notification body copy per kind (§8.4). */
const COPY: Record<ReminderKind, { title: string; body: string }> = {
  stand: { title: 'Debout.', body: '3 minutes. Marche, et regarde par la fenêtre.' },
  mobility: { title: 'Pause mobilité.', body: 'Trois minutes pour une zone qui coince.' },
  eyes: { title: 'Les yeux.', body: 'Regarde au loin, et cligne franchement.' },
}

export interface ScheduleContext {
  /** Opt-in notification sound. Vibration is a channel property, set in
      createChannel, so it is not per-notification here. */
  sound: boolean
  /** Where the notification body-tap should land (§8.4). */
  route: string
}

/** Register the notification channel and the three-action type (§8.3 / §8.4). */
export async function ensureChannelAndActions(): Promise<void> {
  if (!isNative()) return

  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Rappels de pause',
    description: 'Rappels pour se lever et bouger pendant les journées de bureau.',
    importance: 4, // HIGH
    visibility: 1,
    vibration: true,
    // No sound by default — open space (§8.3).
  })

  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE,
        actions: [
          { id: 'done', title: 'Fait' },
          { id: 'snooze', title: '+10 min' },
          { id: 'stop', title: 'Stop', destructive: true },
        ],
      },
    ],
  })
}

// Permissions live in ./permissions.ts: asking is only half the job, since a
// recorded refusal has to be routed to the matching Android settings screen.

function toSchedule(occ: Occurrence, ctx: ScheduleContext): ScheduleOptions['notifications'][number] {
  const copy = COPY[occ.kind]
  return {
    id: occ.id,
    title: copy.title,
    body: copy.body,
    channelId: CHANNEL_ID,
    actionTypeId: ACTION_TYPE,
    schedule: { at: occ.at, allowWhileIdle: true },
    // Sound is opt-in and off by default (open space, §8.3). Vibration is a
    // channel property on Android, so it is set once in createChannel.
    ...(ctx.sound ? { sound: 'default' } : {}),
    smallIcon: 'ic_stat_releve',
    // The deep-link target rides in `extra` — no custom URL scheme (§8.4).
    extra: { route: ctx.route, from: 'notification', kind: occ.kind, occurrenceId: occ.id },
  }
}

/** Schedule a batch of occurrences at once (§8.2). */
export async function scheduleAll(occurrences: Occurrence[], ctx: ScheduleContext): Promise<void> {
  if (!isNative() || occurrences.length === 0) return
  await LocalNotifications.schedule({
    notifications: occurrences.map((o) => toSchedule(o, ctx)),
  })
}

/** Schedule a single occurrence (used by the +10 min snooze). */
export async function scheduleOne(occ: Occurrence, ctx: ScheduleContext): Promise<void> {
  await scheduleAll([occ], ctx)
}

/** Cancel by id. */
export async function cancelIds(ids: number[]): Promise<void> {
  if (!isNative() || ids.length === 0) return
  await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) })
}

export async function getPending(): Promise<PendingResult> {
  if (!isNative()) return { notifications: [] }
  return LocalNotifications.getPending()
}

/**
 * Cancel every pending Relève notification and verify nothing is left (§8.2).
 * Logs if the platform still reports pending ids after the cancel.
 */
export async function cancelAll(): Promise<void> {
  if (!isNative()) return
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    })
  }
  const after = await LocalNotifications.getPending()
  if (after.notifications.length > 0) {
    console.warn('[reminders] notifications still pending after cancelAll', after.notifications)
  }
}
