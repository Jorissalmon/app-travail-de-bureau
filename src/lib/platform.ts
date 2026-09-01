import { Capacitor } from '@capacitor/core'

/** True on a real Capacitor native shell (Android), false in the browser. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

export function platform(): string {
  return Capacitor.getPlatform()
}
