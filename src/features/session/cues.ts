import { KEYS, getRaw, setRaw } from '@/lib/storage'

/**
 * Audio cues for the routine player. The tones are synthesised rather than
 * sampled: three short blips weigh nothing, add no asset to the OTA bundle, and
 * cannot fail to load offline. Deliberately dull and quiet — this is a nudge,
 * not a game sound.
 *
 * Kept out of `Settings` on purpose: that object is replaced wholesale by the
 * server copy on every /api/me, so the preference lives on the device.
 */

/** Seconds before the end of a step that get a tick. */
export const FINAL_COUNTDOWN_S = 5

let enabled = true
let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  return ctx
}

/**
 * A short sine blip. The gain ramps are what keep it from clicking: an
 * oscillator started and stopped at full amplitude pops on both ends.
 */
function blip(freq: number, durationS: number, peak: number): void {
  if (!enabled) return
  const ac = context()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume()

  const t0 = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationS)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + durationS + 0.02)
}

/** One of the last few seconds of a step just elapsed. */
export function cueTick(): void {
  blip(880, 0.07, 0.09)
}

/** A step gives way to the next one. */
export function cueStep(): void {
  blip(1175, 0.13, 0.13)
}

/** The routine is over. */
export function cueEnd(): void {
  blip(1568, 0.32, 0.15)
}

/**
 * Browsers create an AudioContext suspended and only resume it from a user
 * gesture. Call this from the tap that opens the player, or the first tick of
 * the countdown is silently swallowed.
 */
export function primeCues(): void {
  if (!enabled) return
  const ac = context()
  if (ac && ac.state === 'suspended') void ac.resume()
}

export function cuesEnabled(): boolean {
  return enabled
}

/** Reads the stored preference into the module flag. Defaults to on. */
export async function loadCues(): Promise<boolean> {
  enabled = (await getRaw(KEYS.playerSound)) !== '0'
  return enabled
}

export async function setCues(on: boolean): Promise<void> {
  enabled = on
  await setRaw(KEYS.playerSound, on ? '1' : '0')
}
