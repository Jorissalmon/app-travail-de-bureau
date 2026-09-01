import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '@/lib/platform'
import { useSessionStore } from '@/stores/session'
import { flushEvents } from './events'
import { navigateTo } from './deeplink'

/**
 * Wires the native listeners for the reminder engine (§8.4). Registered from
 * main.tsx BEFORE the first render, so a notification tap on a cold start still
 * routes correctly (the target is queued in deeplink.ts until the router mounts).
 */

let installed = false

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

  // Re-plan and flush on every foreground (§8.2).
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return
    void useSessionStore.getState().topUpIfNeeded()
    void flushEvents()
  })
}
