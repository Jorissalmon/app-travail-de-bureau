import { KEYS, getRaw, setRaw } from '@/lib/storage'

/**
 * How loudly a due reminder announces itself, and the sound it makes.
 *
 * A silent heads-up notification is easy to miss while working — which is the
 * whole reason this exists. But the app was designed for an open space (§8.3),
 * so silence stays the default and the choice is the user's, per device: you
 * want a ringing alarm at home and nothing at all in a meeting room, and that
 * is a property of where the phone is, not of the account.
 *
 * Kept out of `Settings` for the same reason as the player's cues: that object
 * is replaced wholesale by the server copy on every /api/me.
 */

export type AlertMode = 'silent' | 'once' | 'repeat'

export const ALERT_MODES: readonly AlertMode[] = ['silent', 'once', 'repeat']

export const ALERT_MODE_LABEL: Record<AlertMode, string> = {
  silent: 'Silencieux',
  once: 'Une fois',
  repeat: 'Répété',
}

/** How often `repeat` sounds again while the exercise stays unanswered. The
    bowl rings for over three seconds, so it needs room to fade before the next
    one; twenty seconds leaves an unmistakable gap. */
const REPEAT_EVERY_MS = 20_000

/** After this long unanswered, `repeat` gives up rather than ring all afternoon. */
const REPEAT_FOR_MS = 5 * 60_000

function isAlertMode(v: string | null): v is AlertMode {
  return v === 'silent' || v === 'once' || v === 'repeat'
}

let mode: AlertMode = 'silent'

export function alertMode(): AlertMode {
  return mode
}

export async function loadAlertMode(): Promise<AlertMode> {
  const stored = await getRaw(KEYS.alertMode)
  mode = isAlertMode(stored) ? stored : 'silent'
  return mode
}

export async function setAlertMode(next: AlertMode): Promise<void> {
  mode = next
  await setRaw(KEYS.alertMode, next)
}

// ---------------------------------------------------------------------------
// The sound
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  return ctx
}

/** The three sine partials that make the bowl, as [frequency, peak gain]. */
const BOWL: readonly (readonly [number, number])[] = [
  [396, 0.15],
  // Detuned by 0.4 % against the fundamental. The two are close enough to be
  // heard as one note, and their difference — about 1.6 beats a second — is
  // the slow shimmer a struck bowl has. Tuning them identically would give a
  // flat synthesiser tone instead.
  [396 * 1.004, 0.12],
  // A quiet inharmonic partial well above: a bowl is not a harmonic series,
  // and this is what stops it sounding like a test tone.
  [396 * 2.7, 0.05],
]

/** Long enough to be unmistakably a bowl rather than a note. */
const BOWL_DECAY_S = 3.2

/**
 * A singing bowl, struck once and left to ring.
 *
 * The slow attack is the whole character: 80 ms rather than the 8 ms of a
 * struck bell means the sound arrives instead of hitting, which is what makes
 * it calm. It is the quietest of the alternatives on purpose — if it turns out
 * to be too easy to work through, the "répété" mode is the answer rather than
 * a louder sound.
 */
function bowl(): void {
  const ac = context()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume()

  const at = ac.currentTime + 0.02
  for (const [freq, peak] of BOWL) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(peak, at + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + BOWL_DECAY_S)
    osc.connect(gain).connect(ac.destination)
    osc.start(at)
    osc.stop(at + BOWL_DECAY_S + 0.1)
  }
}

let repeatTimer: ReturnType<typeof setInterval> | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Sound the alert for a reminder that just came due. Does nothing on `silent`.
 * `repeat` keeps going until stopAlerting() — which every answer calls — or
 * until it has rung for long enough that nobody is there to hear it.
 */
export function startAlerting(): void {
  // Whatever was ringing before is over; a second reminder never stacks two
  // sets of timers on top of each other.
  stopAlerting()
  if (mode === 'silent') return
  bowl()
  if (mode !== 'repeat') return

  repeatTimer = setInterval(bowl, REPEAT_EVERY_MS)
  stopTimer = setTimeout(() => stopAlerting(), REPEAT_FOR_MS)
}

export function stopAlerting(): void {
  if (repeatTimer !== null) {
    clearInterval(repeatTimer)
    repeatTimer = null
  }
  if (stopTimer !== null) {
    clearTimeout(stopTimer)
    stopTimer = null
  }
}

/**
 * Browsers hand out a suspended AudioContext until a user gesture unlocks it.
 * Called from the tap that starts the day, so the alarm half an hour later is
 * not swallowed in silence.
 */
export function primeAlarm(): void {
  const ac = context()
  if (ac && ac.state === 'suspended') void ac.resume()
}
