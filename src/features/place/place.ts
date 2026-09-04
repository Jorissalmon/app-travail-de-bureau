import { KEYS, getRaw, setRaw } from '@/lib/storage'
import type { Exercise, Routine } from '@/lib/types'

/**
 * Where the person is working today, and what that changes.
 *
 * At home anything goes. In an open space, a low lunge or a doorway chest
 * opener is not something most people will actually do, however good it is —
 * so the app stops proposing them rather than pretending.
 *
 * Device-local for the same reason as the alarm mode: it describes where the
 * phone is, not who owns it, and it changes from one day to the next.
 */

export type Place = 'bureau' | 'maison'

/**
 * Below this share of surviving steps, a routine is not trimmed for the office
 * but presented as a home routine. Trimming past half stops being an
 * adaptation and starts being a different, much emptier routine.
 */
const MIN_KEPT = 0.5

export const PLACES: readonly Place[] = ['bureau', 'maison']

export const PLACE_LABEL: Record<Place, string> = {
  bureau: 'Au bureau',
  maison: 'À la maison',
}

function isPlace(v: string | null): v is Place {
  return v === 'bureau' || v === 'maison'
}

let current: Place = 'bureau'

export function place(): Place {
  return current
}

export async function loadPlace(): Promise<Place> {
  const stored = await getRaw(KEYS.place)
  current = isPlace(stored) ? stored : 'bureau'
  return current
}

export async function setPlace(next: Place): Promise<void> {
  current = next
  await setRaw(KEYS.place, next)
}

/**
 * A routine with the movements that do not belong in an open space taken out,
 * positions renumbered and the duration recomputed.
 *
 * Steps are filtered rather than whole routines hidden: "Nuque & trapèzes" is
 * exactly what an office worker needs, and it contains one doorway stretch.
 * Dropping the routine over that one step would be the wrong trade.
 *
 * Returns the routine untouched at home, and also when the office set would
 * gut it: "Réveil" keeps two of its nine movements, and a five-minute wake-up
 * served as forty seconds is worse than one honestly marked as a home routine.
 * Below half the steps, it stays whole and `suitsPlace` reports it as such.
 */
export function adaptToPlace(
  routine: Routine,
  where: Place,
  exerciseByKey: (key: string) => Exercise | undefined,
): Routine {
  if (where === 'maison') return routine

  const kept = routine.steps.filter((s) => exerciseByKey(s.exerciseKey)?.discreet !== false)
  if (kept.length === routine.steps.length) return routine
  if (kept.length < routine.steps.length * MIN_KEPT) return routine

  const steps = kept.map((s, i) => ({ ...s, position: i + 1 }))
  return {
    ...routine,
    steps,
    durationS: steps.reduce((n, s) => n + s.durationS, 0),
  }
}

/** How many movements the office set leaves out, for the note that says so. */
export function hiddenAtOffice(
  routine: Routine,
  where: Place,
  exerciseByKey: (key: string) => Exercise | undefined,
): number {
  if (where === 'maison') return 0
  const adapted = adaptToPlace(routine, where, exerciseByKey)
  // Counted from what actually happened, so the note can never claim a
  // movement was removed when the routine was in fact left whole.
  return routine.steps.length - adapted.steps.length
}

/**
 * False for a routine that an open space cannot really host — the ones left
 * whole above because trimming would have gutted them. The library badges
 * these rather than hiding them: you may well be at home tomorrow.
 */
export function suitsPlace(
  routine: Routine,
  where: Place,
  exerciseByKey: (key: string) => Exercise | undefined,
): boolean {
  if (where === 'maison') return true
  const kept = routine.steps.filter((s) => exerciseByKey(s.exerciseKey)?.discreet !== false)
  return kept.length >= routine.steps.length * MIN_KEPT
}
