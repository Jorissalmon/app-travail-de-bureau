import {
  LocalNotifications,
  type PendingResult,
  type ScheduleOptions,
} from '@capacitor/local-notifications'
import { isNative } from '@/lib/platform'
import type { Occurrence } from './schedule'
import { KINDS, alertRoute } from './kinds'
import { nudgeFor } from '@/features/session/daypart'
import { cancelWakeAlerts, scheduleWakeAlerts } from './screenwake'

/**
 * Thin wrapper over @capacitor/local-notifications (§8). All scheduling is
 * local — the server never sends a push. On the web the plugin is a no-op, so
 * the app still runs in a browser for development.
 */

export const CHANNEL_ID = 'releve_breaks'
/**
 * A second channel, identical but for the sound. Android will not let an
 * existing channel's sound be changed — which is why the "Son" toggle could
 * never do anything on Android 8+ — so the only way to offer both is to create
 * both and choose per notification.
 */
export const CHANNEL_ID_SOUND = 'releve_breaks_bol'
export const ACTION_TYPE = 'RELEVE_BREAK'

export interface ScheduleContext {
  /** Opt-in notification sound. Vibration is a channel property, set in
      createChannel, so it is not per-notification here. */
  sound: boolean
}

/** Which of the two channels a notification should land on. */
function channelFor(ctx: ScheduleContext): string {
  return ctx.sound ? CHANNEL_ID_SOUND : CHANNEL_ID
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
    // No sound — open space (§8.3). This is still the default channel.
  })

  await LocalNotifications.createChannel({
    id: CHANNEL_ID_SOUND,
    name: 'Rappels de pause (avec le bol)',
    description: 'Les mêmes rappels, annoncés par le bol.',
    importance: 4, // HIGH
    visibility: 1,
    vibration: true,
    // res/raw/bol.wav — Android plays it itself, so a reminder is audible even
    // when the app is not running and cannot synthesise anything.
    sound: 'bol',
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
  const copy = KINDS[occ.kind]
  return {
    id: occ.id,
    title: copy.title,
    // The stand reminder speaks to the hour it fires at — the reason to get up
    // at 15 h is not the reason at 9 h. The other two are about a body part,
    // and time does not change what they are for.
    body: occ.kind === 'stand' ? nudgeFor(occ.at) : copy.body,
    channelId: channelFor(ctx),
    actionTypeId: ACTION_TYPE,
    schedule: { at: occ.at, allowWhileIdle: true },
    // Sound is opt-in and off by default (open space, §8.3). Vibration is a
    // channel property on Android, so it is set once in createChannel.
    ...(ctx.sound ? { sound: 'default' } : {}),
    smallIcon: 'ic_stat_logoff',
    // The deep-link target rides in `extra` — no custom URL scheme (§8.4). It
    // is derived from the kind so the tap lands on the matching alert screen.
    extra: { route: alertRoute(occ.kind), kind: occ.kind, occurrenceId: occ.id },
  }
}

/** Schedule a batch of occurrences at once (§8.2). */
export async function scheduleAll(occurrences: Occurrence[], ctx: ScheduleContext): Promise<void> {
  if (!isNative() || occurrences.length === 0) return
  await LocalNotifications.schedule({
    notifications: occurrences.map((o) => toSchedule(o, ctx)),
  })
  // A notification alone is not read through a dark screen: mirror every
  // occurrence with a native alarm that turns the screen on (§8.3).
  await scheduleWakeAlerts(
    occurrences.map((o) => ({
      id: o.id,
      at: o.at.getTime(),
      route: alertRoute(o.kind),
      title: KINDS[o.kind].title,
      // Asked to be alerted: the break takes the screen whatever its state.
      always: ctx.sound,
    })),
  )
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
 * Cancel every pending Log Off notification and verify nothing is left (§8.2).
 * Logs if the platform still reports pending ids after the cancel.
 */
export async function cancelAll(): Promise<void> {
  if (!isNative()) return
  await cancelWakeAlerts()
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
