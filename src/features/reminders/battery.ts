import { BatteryOptimization } from '@capawesome-team/capacitor-android-battery-optimization'
import { isNative, platform } from '@/lib/platform'

/**
 * Battery optimisation (§8.3). Manufacturer power management is what actually
 * kills reminder apps: while the app is optimised, Android delays or drops its
 * alarms however they were scheduled. Every call is a no-op off Android.
 */

function available(): boolean {
  return isNative() && platform() === 'android'
}

/** True when Android still optimises the app — reminders may then be late. */
export async function isOptimised(): Promise<boolean> {
  if (!available()) return false
  try {
    const { enabled } = await BatteryOptimization.isBatteryOptimizationEnabled()
    return enabled
  } catch {
    return false
  }
}

/**
 * Asks the system for an exemption. Falls back to the battery settings page
 * when the direct dialog is unavailable, as on some manufacturer ROMs.
 */
export async function requestExemption(): Promise<void> {
  if (!available()) return
  try {
    await BatteryOptimization.requestIgnoreBatteryOptimization()
  } catch {
    try {
      await BatteryOptimization.openBatteryOptimizationSettings()
    } catch {
      /* Nothing else to offer — the notice copy already names the setting. */
    }
  }
}
