import { registerPlugin } from '@capacitor/core'
import { isNative, platform } from '@/lib/platform'

/**
 * Asking Android to turn everything else down while the bowl rings.
 *
 * A web page cannot do this: there is no audio-focus API in the browser, so a
 * sound played through Web Audio simply lands on top of whatever music or
 * podcast is already playing, and loses. Android arbitrates that with
 * AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK, which the media app itself honours by
 * dropping its volume for the duration and putting it back afterwards.
 *
 * It lives on the ScreenWake plugin because that is the native code this app
 * already ships. Every call is guarded: an OTA bundle can land on an APK built
 * before these methods existed, and the reminder must still ring there — just
 * without ducking.
 */

interface AudioFocusPlugin {
  duckOthers(): Promise<void>
  stopDucking(): Promise<void>
}

const ScreenWake = registerPlugin<AudioFocusPlugin>('ScreenWake')

function available(): boolean {
  return isNative() && platform() === 'android'
}

/** Ask the system to duck other audio. Silently does nothing off Android. */
export async function duckOthers(): Promise<void> {
  if (!available()) return
  try {
    await ScreenWake.duckOthers()
  } catch {
    /* Older shell: the bowl still rings, it just does not duck. */
  }
}

/** Give the focus back, so the music comes up again. */
export async function stopDucking(): Promise<void> {
  if (!available()) return
  try {
    await ScreenWake.stopDucking()
  } catch {
    /* Nothing held, nothing to give back. */
  }
}
