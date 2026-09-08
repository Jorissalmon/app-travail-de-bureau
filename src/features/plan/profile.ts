import { KEYS, getJSON, setJSON, remove } from '@/lib/storage'
import type { PainDuration, PainProfile, PlanMinutes, Zone } from '@/lib/types'

/**
 * What the first run asked, kept on the device.
 *
 * Not part of `Settings`: /api/me replaces that object wholesale, and this is
 * what the plan is composed from — losing it to a sync round trip would serve
 * someone a session for a zone they never mentioned. It follows the same rule
 * as the welcome flag and the place.
 */

export const PLAN_MINUTES: readonly PlanMinutes[] = [4, 6, 8]

export const DURATION_LABEL: Record<PainDuration, string> = {
  'moins-1-mois': 'Moins d’un mois',
  '1-6-mois': 'Un à six mois',
  'plus-6-mois': 'Plus de six mois',
}

/**
 * Past this, the app says the same thing as the footer of the profile screen,
 * once, in the flow rather than in the small print: a pain that has lasted
 * this long is a question for a professional, not for a phone.
 */
export const LONG_STANDING: PainDuration = 'plus-6-mois'

let current: PainProfile | null = null

export function profile(): PainProfile | null {
  return current
}

export async function loadProfile(): Promise<PainProfile | null> {
  current = await getJSON<PainProfile | null>(KEYS.painProfile, null)
  return current
}

export async function saveProfile(next: PainProfile): Promise<void> {
  current = next
  await setJSON(KEYS.painProfile, next)
}

export async function clearProfile(): Promise<void> {
  current = null
  await remove(KEYS.painProfile)
}

/** The profile of someone who declared nothing: the plan still has to work. */
export function emptyProfile(minutes: PlanMinutes = 6): PainProfile {
  return { zones: [], baseline: {}, since: null, minutes, startedAt: new Date().toISOString() }
}

/** Zones ordered by the rating given at first run, most painful first. */
export function declaredOrder(p: PainProfile): Zone[] {
  return [...p.zones].sort((a, b) => (p.baseline[b] ?? 0) - (p.baseline[a] ?? 0))
}
