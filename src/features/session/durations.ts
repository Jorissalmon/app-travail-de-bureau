import { KEYS, getJSON, setJSON } from '@/lib/storage'

/**
 * Per-step duration overrides, so a routine can be made shorter or longer
 * without editing the content everyone shares.
 *
 * Device-local on purpose: `Settings` is replaced wholesale by the server copy
 * on every /api/me, so a field there would be overwritten — and doing it
 * properly would cost a SQL migration for what is a personal preference.
 */

/** The -/+ steppers move by this much, and stay inside these bounds. */
export const DURATION_STEP_S = 10
export const MIN_DURATION_S = 10
export const MAX_DURATION_S = 300

type Overrides = Record<string, Record<string, number>>

let overrides: Overrides = {}

export function clampDuration(seconds: number): number {
  const snapped = Math.round(seconds / DURATION_STEP_S) * DURATION_STEP_S
  return Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, snapped))
}

export async function loadDurations(): Promise<void> {
  overrides = await getJSON<Overrides>(KEYS.stepDurations, {})
}

/** The duration to actually run, falling back to the content's own value. */
export function durationFor(slug: string, position: number, fallback: number): number {
  const seconds = overrides[slug]?.[String(position)]
  return typeof seconds === 'number' ? clampDuration(seconds) : fallback
}

/** True when the user has moved at least one step of this routine. */
export function isCustomised(slug: string): boolean {
  return Object.keys(overrides[slug] ?? {}).length > 0
}

export async function setDuration(
  slug: string,
  position: number,
  seconds: number,
): Promise<void> {
  const next = { ...(overrides[slug] ?? {}), [String(position)]: clampDuration(seconds) }
  overrides = { ...overrides, [slug]: next }
  await setJSON(KEYS.stepDurations, overrides)
}

export async function resetRoutine(slug: string): Promise<void> {
  if (!overrides[slug]) return
  const next = { ...overrides }
  delete next[slug]
  overrides = next
  await setJSON(KEYS.stepDurations, overrides)
}

/** Total of a routine once the overrides are applied. */
export function totalFor(slug: string, steps: { position: number; durationS: number }[]): number {
  return steps.reduce((n, s) => n + durationFor(slug, s.position, s.durationS), 0)
}
