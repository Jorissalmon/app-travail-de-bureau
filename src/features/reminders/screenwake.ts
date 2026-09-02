import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { isNative, platform } from '@/lib/platform'

/**
 * Bridge to the native ScreenWake plugin: an alarm mirroring each reminder,
 * whose only job is to turn the screen on and show the alert page over the
 * lock screen. Everything else stays on @capacitor/local-notifications.
 *
 * Every call is best-effort. An OTA bundle can land on an APK built before the
 * plugin existed, and a missing plugin must never stop a session from starting.
 */

export interface WakeAlert {
  id: number
  /** Epoch milliseconds. */
  at: number
  /** Route the app opens on, same value as the notification's `extra.route`. */
  route: string
  title: string
}

interface ScreenWakePlugin {
  schedule(options: { alerts: WakeAlert[] }): Promise<void>
  cancelAll(): Promise<void>
  checkPermission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  addListener(
    eventName: 'wakeAlert',
    listener: (data: { route: string }) => void,
  ): Promise<PluginListenerHandle>
}

const ScreenWake = registerPlugin<ScreenWakePlugin>('ScreenWake')

function available(): boolean {
  return isNative() && platform() === 'android'
}

export async function scheduleWakeAlerts(alerts: WakeAlert[]): Promise<void> {
  if (!available() || alerts.length === 0) return
  try {
    await ScreenWake.schedule({ alerts })
  } catch {
    /* Older APK without the plugin: the ordinary notification still fires. */
  }
}

export async function cancelWakeAlerts(): Promise<void> {
  if (!available()) return
  try {
    await ScreenWake.cancelAll()
  } catch {
    /* Nothing to cancel if the plugin is not there. */
  }
}

/** True when Android will honour a full-screen intent (always, below 14). */
export async function canWakeScreen(): Promise<boolean> {
  if (!available()) return true
  try {
    const { granted } = await ScreenWake.checkPermission()
    return granted
  } catch {
    return true
  }
}

export async function requestWakeScreen(): Promise<boolean> {
  if (!available()) return true
  try {
    const { granted } = await ScreenWake.requestPermission()
    return granted
  } catch {
    return true
  }
}

/** Fired when the app was launched by a wake alarm; carries the alert route. */
export async function onWakeAlert(fn: (route: string) => void): Promise<void> {
  if (!available()) return
  try {
    await ScreenWake.addListener('wakeAlert', ({ route }) => fn(route))
  } catch {
    /* No plugin, no event. */
  }
}
