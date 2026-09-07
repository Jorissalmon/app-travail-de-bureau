import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { uuid } from '@/lib/uuid'
import { stepTone } from '@/lib/tones'
import type { Routine, RoutineStep } from '@/lib/types'

/**
 * Routines the user composes, out of the exercises the app already ships.
 *
 * Device-local, like the per-step durations and for the same reason: `Settings`
 * is replaced wholesale by the server copy on every /api/me, and giving these
 * a table of their own would mean a migration, endpoints, synchronisation and
 * conflict rules for something used on one phone. The stored shape is the
 * transposable one, so moving them to the server later changes where they live,
 * not what they are.
 *
 * Only the choices are stored — which exercise, in what order, for how long.
 * Everything a screen needs to draw (name, cue, illustration) is rebuilt from
 * the catalogue, so a correction to an exercise reaches routines built from it.
 */

/** What a user actually decides about a step. */
export interface CustomStep {
  exerciseKey: string
  durationS: number
}

export interface CustomRoutine {
  slug: string
  title: string
  steps: CustomStep[]
  createdAt: string
}

/** Prefix guarantees a user's routine can never collide with a shipped slug. */
const SLUG_PREFIX = 'perso-'

export const MIN_STEP_S = 10
export const MAX_STEP_S = 300
export const STEP_INCREMENT_S = 10

export function isCustomSlug(slug: string): boolean {
  return slug.startsWith(SLUG_PREFIX)
}

export function clampStep(seconds: number): number {
  const snapped = Math.round(seconds / STEP_INCREMENT_S) * STEP_INCREMENT_S
  return Math.min(MAX_STEP_S, Math.max(MIN_STEP_S, snapped))
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let routines: CustomRoutine[] = []

export function customRoutines(): CustomRoutine[] {
  return routines
}

export async function loadCustomRoutines(): Promise<CustomRoutine[]> {
  routines = await getJSON<CustomRoutine[]>(KEYS.customRoutines, [])
  return routines
}

async function persist(next: CustomRoutine[]): Promise<CustomRoutine[]> {
  routines = next
  await setJSON(KEYS.customRoutines, next)
  return next
}

export async function createCustomRoutine(title: string): Promise<CustomRoutine> {
  const routine: CustomRoutine = {
    slug: `${SLUG_PREFIX}${uuid().slice(0, 8)}`,
    title: title.trim() || 'Ma routine',
    steps: [],
    createdAt: new Date().toISOString(),
  }
  await persist([...routines, routine])
  return routine
}

export async function deleteCustomRoutine(slug: string): Promise<void> {
  await persist(routines.filter((r) => r.slug !== slug))
}

async function edit(
  slug: string,
  fn: (r: CustomRoutine) => CustomRoutine,
): Promise<CustomRoutine | undefined> {
  const next = routines.map((r) => (r.slug === slug ? fn(r) : r))
  await persist(next)
  return next.find((r) => r.slug === slug)
}

export async function renameCustomRoutine(slug: string, title: string): Promise<void> {
  await edit(slug, (r) => ({ ...r, title: title.trim() || r.title }))
}

export async function addCustomStep(
  slug: string,
  exerciseKey: string,
  durationS: number,
): Promise<void> {
  await edit(slug, (r) => ({
    ...r,
    steps: [...r.steps, { exerciseKey, durationS: clampStep(durationS) }],
  }))
}

export async function removeCustomStep(slug: string, index: number): Promise<void> {
  await edit(slug, (r) => ({ ...r, steps: r.steps.filter((_, i) => i !== index) }))
}

export async function setCustomStepDuration(
  slug: string,
  index: number,
  durationS: number,
): Promise<void> {
  await edit(slug, (r) => ({
    ...r,
    steps: r.steps.map((s, i) => (i === index ? { ...s, durationS: clampStep(durationS) } : s)),
  }))
}

/**
 * Write the whole list at once.
 *
 * The builder edits its own copy and draws from it, so a tap lands on screen
 * immediately instead of after a write to device storage and a rebuild of every
 * routine. This is what it saves afterwards, in the background.
 */
export async function setCustomSteps(slug: string, steps: CustomStep[]): Promise<void> {
  await edit(slug, (r) => ({
    ...r,
    steps: steps.map((s) => ({ ...s, durationS: clampStep(s.durationS) })),
  }))
}

/** Swap a step with its neighbour. Out-of-range moves are a no-op, not an error:
    the buttons at either end of the list are simply disabled. */
export async function moveCustomStep(slug: string, index: number, delta: -1 | 1): Promise<void> {
  await edit(slug, (r) => {
    const to = index + delta
    if (to < 0 || to >= r.steps.length) return r
    const steps = [...r.steps]
    const a = steps[index]
    const b = steps[to]
    if (!a || !b) return r
    steps[index] = b
    steps[to] = a
    return { ...r, steps }
  })
}

// ---------------------------------------------------------------------------
// Turning choices back into a routine the rest of the app can draw
// ---------------------------------------------------------------------------

/** One entry of the picker: an exercise, with what a step made from it looks like. */
export interface CatalogueEntry {
  exerciseKey: string
  name: string
  cue: string
  figureKey: string
  durationS: number
}

/**
 * Every distinct exercise the shipped routines use, with a representative
 * name, cue, illustration and duration taken from its first appearance.
 *
 * The exercise library holds the explanation of a movement; the illustration
 * and the short spoken cue live on the steps. This is what joins the two, and
 * it is why a user's routine never needs content of its own.
 */
export function buildCatalogue(catalogue: Routine[]): CatalogueEntry[] {
  const seen = new Map<string, CatalogueEntry>()
  for (const routine of catalogue) {
    for (const step of routine.steps) {
      if (seen.has(step.exerciseKey)) continue
      seen.set(step.exerciseKey, {
        exerciseKey: step.exerciseKey,
        name: step.name,
        cue: step.cue,
        figureKey: step.figureKey,
        durationS: step.durationS,
      })
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/**
 * A stored routine, rebuilt into the same shape as a shipped one so that the
 * library, the detail screen and the player need to know nothing about it.
 * Steps whose exercise no longer exists are dropped rather than drawn broken.
 */
export function materialise(custom: CustomRoutine, entries: CatalogueEntry[]): Routine {
  const byKey = new Map(entries.map((e) => [e.exerciseKey, e]))
  const steps: RoutineStep[] = []
  for (const step of custom.steps) {
    const entry = byKey.get(step.exerciseKey)
    if (!entry) continue
    steps.push({
      position: steps.length + 1,
      name: entry.name,
      durationS: step.durationS,
      cue: entry.cue,
      figureKey: entry.figureKey,
      exerciseKey: step.exerciseKey,
    })
  }

  return {
    id: custom.slug,
    slug: custom.slug,
    title: custom.title,
    // Custom routines are not filed under a body zone: they appear in their own
    // section of the library, so this only ever feeds the colour of the card.
    zone: 'bureau',
    durationS: steps.reduce((n, s) => n + s.durationS, 0),
    summary:
      steps.length === 0
        ? 'Vide pour l’instant — ajoute des exercices.'
        : `${steps.length} exercice${steps.length > 1 ? 's' : ''}, composés par toi.`,
    accent: stepTone(custom.slug),
    sortOrder: 0,
    steps,
  }
}
