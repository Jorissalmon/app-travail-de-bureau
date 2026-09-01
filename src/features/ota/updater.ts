import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { App } from '@capacitor/app'
import { isNative } from '@/lib/platform'
import { KEYS, getRaw, setRaw } from '@/lib/storage'
import { meetsMinimum, semverGt } from './semver'

/**
 * Self-hosted OTA (§9). The plugin runs in manual mode (autoUpdate: false in
 * capacitor.config), so we drive download/set ourselves against a manifest on
 * the Vercel domain. No Capgo cloud account, no cost.
 */

interface Manifest {
  version: string
  url: string
  checksum?: string
  minNative: string
  notes?: string
}

/** Version baked into this bundle at build time (§9.3). */
export const BUNDLE_VERSION = import.meta.env.VITE_BUNDLE_VERSION ?? '0.0.0'

const OTA_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/**
 * MUST be called before anything else at startup: without notifyAppReady the
 * plugin considers the bundle broken and rolls back after 10 s (§9.3).
 */
export async function notifyReady(): Promise<void> {
  if (!isNative()) return
  try {
    await CapacitorUpdater.notifyAppReady()
  } catch (e) {
    console.warn('[ota] notifyAppReady failed', e)
  }
}

/** True when a native reinstall is required (a plugin changed) — shown in Settings. */
export async function isNativeUpdatePending(): Promise<boolean> {
  return (await getRaw(KEYS.pendingNativeUpdate)) === '1'
}

/**
 * Background update check (§9.3). Never blocks the first paint — call it after
 * the app has rendered. Downloads only when a newer version exists; applies at
 * the next background transition.
 */
export async function checkForUpdate(): Promise<void> {
  if (!isNative()) return
  try {
    const res = await fetch(`${OTA_BASE}/ota/manifest.json`, { cache: 'no-store' })
    if (!res.ok) return
    const manifest = (await res.json()) as Manifest

    if (!semverGt(manifest.version, BUNDLE_VERSION)) return

    // A bundle that needs a newer native shell must not be applied — surface a
    // banner in Settings instead (§9.3).
    const native = await currentNativeVersion()
    if (!meetsMinimum(native, manifest.minNative)) {
      await setRaw(KEYS.pendingNativeUpdate, '1')
      return
    }
    await setRaw(KEYS.pendingNativeUpdate, '0')

    const bundle = await CapacitorUpdater.download({
      version: manifest.version,
      url: manifest.url,
      ...(manifest.checksum ? { checksum: manifest.checksum } : {}),
    })
    // Applied on the next move to background; the plugin keeps the previous
    // bundle for automatic rollback on a startup crash (§9.3).
    await CapacitorUpdater.set(bundle)
  } catch (e) {
    console.warn('[ota] update check failed', e)
  }
}

async function currentNativeVersion(): Promise<string> {
  try {
    const info = await App.getInfo()
    return info.version
  } catch {
    return BUNDLE_VERSION
  }
}
