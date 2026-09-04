import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '@/lib/platform'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { nextAutoStart } from './schedule'
import { alertMode } from './alert'
import { AUTO_START_ID, CHANNEL_ID, CHANNEL_ID_SOUND, DAY_ACTION_TYPE } from './notifications'

/**
 * « Démarrage auto », which until now was a setting that saved, synced, and did
 * nothing at all: no code outside the settings screen ever read `autoStartAt`.
 *
 * What it does is arm one notification at the hour set, on the days marked
 * active, whose first action starts the day. It deliberately does NOT start the
 * session by itself. A session opened without you would be measuring a chair
 * you are not sitting in, and every number the app shows — the longest sitting,
 * the response rate, the streak — is only worth having because it is not made
 * up. The reminder that matters in the morning is not the one to get up; it is
 * the one to begin.
 *
 * Only ever one is armed, replaced whenever the setting, the active days or the
 * session state change, and re-armed on every foreground. Like the rest of the
 * engine it cannot run while the app does not: if the phone never opens the app
 * for a week, the invitation waiting is the next one that was armed, not seven.
 */

const TITLE = 'Ta journée peut commencer.'
const BODY = 'Un appui, et les rappels reprennent.'

/**
 * The instant currently armed, or null for "nothing". `undefined` until the
 * first sync, so a setting cleared while the app was closed is still cancelled.
 */
let armed: number | null | undefined = undefined
let installed = false

/** Cancel what is armed and put the next invitation in its place. */
async function arm(at: Date | null): Promise<void> {
  const target = at?.getTime() ?? null
  if (armed !== undefined && target === armed) return

  await LocalNotifications.cancel({ notifications: [{ id: AUTO_START_ID }] }).catch(() => {
    /* Nothing pending is not a failure. */
  })

  if (at !== null) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: AUTO_START_ID,
          title: TITLE,
          body: BODY,
          // Same rule as a reminder: the bowl only where the user asked for it.
          channelId: alertMode() === 'silent' ? CHANNEL_ID : CHANNEL_ID_SOUND,
          actionTypeId: DAY_ACTION_TYPE,
          schedule: { at, allowWhileIdle: true },
          smallIcon: 'ic_stat_logoff',
          // A tap on the body lands on the home screen, where the same button
          // is. No wake alarm is mirrored on it: being invited to start a day
          // is not worth taking over a dark screen for.
          extra: { route: '/', autoStart: true },
        },
      ],
    })
  }
  armed = target
}

/**
 * Read the setting and the session, and arm accordingly. Nothing is armed while
 * a day is already running — the invitation would be to a day in progress.
 */
export async function syncAutoStart(): Promise<void> {
  if (!isNative()) return
  const { settings, loaded } = useSettingsStore.getState()
  const { session, ready } = useSessionStore.getState()
  // Before either store has read the device, `settings` is still the defaults;
  // acting on them would cancel an invitation the user has actually set.
  if (!loaded || !ready) return

  const at = session ? null : nextAutoStart(settings.autoStartAt, settings.weekdays, new Date())
  try {
    await arm(at)
  } catch (e) {
    // An OTA bundle can land on a shell whose plugin is older; a morning
    // invitation is never worth failing a boot over.
    console.warn('[autostart] could not arm', e)
  }
}

/**
 * Watch the two things that decide it — the setting and whether a day is
 * running — plus every return to the foreground, which is what re-arms it for
 * tomorrow once today's has fired.
 */
export function installAutoStart(): void {
  if (installed || !isNative()) return
  installed = true

  useSettingsStore.subscribe((state, prev) => {
    if (
      state.loaded !== prev.loaded ||
      state.settings.autoStartAt !== prev.settings.autoStartAt ||
      state.settings.weekdays !== prev.settings.weekdays
    ) {
      void syncAutoStart()
    }
  })

  useSessionStore.subscribe((state, prev) => {
    if (state.ready !== prev.ready || (state.session === null) !== (prev.session === null)) {
      void syncAutoStart()
    }
  })

  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void syncAutoStart()
  })

  void syncAutoStart()
}
