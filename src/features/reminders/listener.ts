import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '@/lib/platform'
import { useSessionStore } from '@/stores/session'
import { flushEvents } from './events'
import { navigateTo } from './deeplink'
import { onWakeAlert } from './screenwake'
import { alertRoute } from './kinds'

/**
 * Wires the native listeners for the reminder engine (§8.4). Registered from
 * main.tsx BEFORE the first render, so a notification tap on a cold start still
 * routes correctly (the target is queued in deeplink.ts until the router mounts).
 */

let installed = false

/**
 * A routine already on screen is never interrupted: the reminder that just
 * fired waits in the shade rather than replacing the exercise being done.
 * HashRouter, so the current route is the hash.
 */
function inPlayer(): boolean {
  return window.location.hash.startsWith('#/player/')
}

export function installReminderListeners(): void {
  if (installed || !isNative()) return
  installed = true

  LocalNotifications.addListener('localNotificationActionPerformed', async (event) => {
    const extra = (event.notification.extra ?? {}) as { route?: string }
    const firedAt = new Date()
    const action = event.actionId

    const store = useSessionStore.getState()

    if (action === 'done') {
      await store.markDone(firedAt)
      return
    }
    if (action === 'snooze') {
      await store.snooze(firedAt)
      return
    }
    if (action === 'stop') {
      await store.stop({ via: 'notification' })
      return
    }
    // Body tap (actionId === 'tap'): open the player (§8.4).
    if (extra.route) navigateTo(extra.route)
  })

  // The break page opens by itself, without waiting for a tap — the whole
  // point is not having to decide anything (§8.4). Fires whenever the app is
  // running as the notification is posted.
  //
  // It goes through the same reconciliation as a cold start rather than jumping
  // straight to the route: that is what records the reminder as owed, so
  // walking away from the page without answering leaves it owed either way.
  LocalNotifications.addListener('localNotificationReceived', () => {
    void catchUpAndRoute()
  })

  // Woken from a dark screen by the native alarm: the app was just launched
  // over the lock screen and has to land on the right break.
  void onWakeAlert(() => {
    void catchUpAndRoute()
  })

  // Look at the clock and flush on every foreground (§8.2).
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return
    void catchUpAndRoute()
    void flushEvents()
  })
}

/**
 * Reconcile with the clock, then land on the exercise if one is owed. This is
 * what makes a missed notification unmissable: the reminder fired while the app
 * was closed, nothing else was armed behind it, and opening the app puts the
 * break on screen instead of the home page.
 *
 * Called on boot as well as on every foreground, since a cold start has no
 * state change to listen for.
 */
export async function catchUpAndRoute(): Promise<void> {
  const store = useSessionStore.getState()
  await store.catchUp()
  const { awaiting } = useSessionStore.getState()
  if (awaiting && !inPlayer()) navigateTo(alertRoute(awaiting.kind))
}
