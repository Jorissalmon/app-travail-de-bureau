import { Capacitor, registerPlugin } from '@capacitor/core'
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
 *
 * Two paths are tried, in this order:
 *
 *  1. The Audio Session API (`navigator.audioSession`), the web's own answer:
 *     a page declares its audio is `transient`, and the platform ducks the rest
 *     for its duration. Experimental, absent from Chrome and the Android
 *     WebView at the time of writing, so it is feature-detected and costs
 *     nothing when missing. The day the WebView ships it, ducking stops needing
 *     an APK at all.
 *  2. The native audio focus request, which works today.
 *
 * Worth knowing, because it decides how much of this matters: a reminder that
 * fires while the app is NOT in the foreground is sounded by Android itself,
 * from the notification channel, whose attributes are USAGE_NOTIFICATION and
 * CONTENT_TYPE_SONIFICATION. Android has ducked media for exactly that
 * combination since version 8. So the case this file exists for is the other
 * one: the app on screen, the bowl synthesised in the webview.
 */

interface AudioFocusPlugin {
  duckOthers(): Promise<void>
  stopDucking(): Promise<void>
}

const ScreenWake = registerPlugin<AudioFocusPlugin>('ScreenWake')

function available(): boolean {
  return isNative() && platform() === 'android'
}

/** `navigator.audioSession`, when the engine has it. Not in lib.dom yet. */
interface AudioSessionLike {
  type: string
}

function webSession(): AudioSessionLike | null {
  const nav = navigator as Navigator & { audioSession?: AudioSessionLike }
  return nav.audioSession ?? null
}

/**
 * Whether anything here can actually turn the music down.
 *
 * Worth exposing rather than failing quietly: an OTA bundle lands on whatever
 * APK is installed, and `duckOthers` only exists in the shell from 1.4.0 on.
 * On an older one the call below rejects with an "is not implemented" exception
 * that this file swallows — correct, because the bowl must still ring, but it
 * meant the settings screen promised ducking that could never happen. The
 * screen asks first now, and says so when the answer is no.
 *
 * Capacitor's native bridge injects `PluginHeaders`, one entry per plugin with
 * the methods that shell was compiled with, so this is answerable on the spot
 * and without calling anything.
 */
export function canDuck(): boolean {
  if (webSession()) return true
  if (!available()) return false
  const headers = (Capacitor as { PluginHeaders?: readonly { name: string; methods: readonly { name: string }[] }[] })
    .PluginHeaders
  if (!headers) return false
  const screenWake = headers.find((h) => h.name === 'ScreenWake')
  return screenWake?.methods.some((m) => m.name === 'duckOthers') ?? false
}

/** Ask the system to duck other audio, by whichever route this engine offers. */
export async function duckOthers(): Promise<void> {
  const session = webSession()
  if (session) {
    try {
      session.type = 'transient'
    } catch {
      /* A type the engine refuses: fall through to the native route. */
    }
  }
  if (!available()) return
  try {
    await ScreenWake.duckOthers()
  } catch {
    /* Older shell: the bowl still rings, it just does not duck. */
  }
}

/** Give the focus back, so the music comes up again. */
export async function stopDucking(): Promise<void> {
  const session = webSession()
  if (session) {
    try {
      session.type = 'auto'
    } catch {
      /* Nothing to hand back on this engine. */
    }
  }
  if (!available()) return
  try {
    await ScreenWake.stopDucking()
  } catch {
    /* Nothing held, nothing to give back. */
  }
}
