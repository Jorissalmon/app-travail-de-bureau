import { LocalNotifications } from '@capacitor/local-notifications'
import { AndroidSettings, NativeSettings } from 'capacitor-native-settings'
import { isNative, platform } from '@/lib/platform'
import { isOptimised, requestExemption } from './battery'

/**
 * The three grants a reminder actually needs to fire (§8.3). Asking is not
 * enough: once Android has recorded a refusal it never shows the dialog again,
 * so every entry also knows how to land the user on the screen where the
 * "Autoriser" button lives.
 *
 * Off Android everything reads as granted, so the browser used for development
 * is never blocked.
 */

export type PermissionKey = 'notifications' | 'exactAlarms' | 'battery'

export type PermissionState = Record<PermissionKey, boolean>

export const PERMISSION_ORDER: PermissionKey[] = ['notifications', 'exactAlarms', 'battery']

export const PERMISSION_COPY: Record<PermissionKey, { label: string; why: string }> = {
  notifications: {
    label: 'Notifications',
    why: 'Sans elles, aucun rappel ne peut apparaître.',
  },
  exactAlarms: {
    label: 'Alarmes exactes',
    why: 'Sinon Android décale les rappels de plusieurs minutes.',
  },
  battery: {
    label: 'Optimisation de la batterie',
    why: 'Tant qu’elle est active, Android met l’app en veille et supprime les rappels.',
  },
}

const ALL_GRANTED: PermissionState = { notifications: true, exactAlarms: true, battery: true }

function onAndroid(): boolean {
  return isNative() && platform() === 'android'
}

export function allGranted(state: PermissionState): boolean {
  return PERMISSION_ORDER.every((k) => state[k])
}

export function missing(state: PermissionState): PermissionKey[] {
  return PERMISSION_ORDER.filter((k) => !state[k])
}

/**
 * Exact alarms are auto-granted when USE_EXACT_ALARM is in the manifest, which
 * it is — but an OS or plugin that does not know the API must not read as
 * refused, or the app would block on something it cannot fix.
 */
async function readExactAlarms(): Promise<boolean> {
  try {
    const setting = await LocalNotifications.checkExactNotificationSetting()
    return setting.exact_alarm === 'granted'
  } catch {
    return true
  }
}

export async function readPermissions(): Promise<PermissionState> {
  if (!onAndroid()) return { ...ALL_GRANTED }
  const [display, exactAlarms, optimised] = await Promise.all([
    LocalNotifications.checkPermissions()
      .then((p) => p.display === 'granted')
      .catch(() => false),
    readExactAlarms(),
    isOptimised(),
  ])
  return { notifications: display, exactAlarms, battery: !optimised }
}

/**
 * Runs the grant flow for one entry. Returns the state read afterwards, which
 * may still be refused: several of these hand off to a system screen the user
 * has to come back from, and the sheet re-reads on resume.
 */
export async function requestPermission(key: PermissionKey): Promise<PermissionState> {
  if (!onAndroid()) return { ...ALL_GRANTED }

  if (key === 'notifications') {
    let granted = false
    try {
      const res = await LocalNotifications.requestPermissions()
      granted = res.display === 'granted'
    } catch {
      granted = false
    }
    // A recorded refusal makes requestPermissions() return without showing
    // anything, so the app settings are the only remaining way in.
    if (!granted) {
      await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification }).catch(() =>
        NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails }),
      )
    }
  }

  if (key === 'exactAlarms') {
    try {
      await LocalNotifications.changeExactNotificationSetting()
    } catch {
      /* Unsupported OS or plugin: readExactAlarms() already reads as granted. */
    }
  }

  if (key === 'battery') {
    await requestExemption()
  }

  return readPermissions()
}

/** Thrown by the session store when a reminder session cannot legitimately start. */
export class PermissionsMissingError extends Error {
  readonly state: PermissionState
  constructor(state: PermissionState) {
    super('Les autorisations nécessaires aux rappels manquent.')
    this.name = 'PermissionsMissingError'
    this.state = state
  }
}
