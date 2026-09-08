import { daysBetween } from '@/lib/date'
import { DISCRETION, type Place } from '@/features/place/place'
import { PAIN_ZONES, PAIN_ZONE_LABEL } from '@/content'
import { trend } from './painStats'
import { latestScore } from './painStats'
import type {
  AdaptivePlan,
  Exercise,
  ExerciseType,
  PainEntry,
  PainProfile,
  PlanBlock,
  Routine,
  RoutineGoal,
  Zone,
} from '@/lib/types'

/**
 * The adaptive plan: what the app proposes today, composed rather than picked.
 *
 * A fixed routine per zone was the old model, and it is the abandonment case
 * the pivot exists for — someone who opens « Nuque » twice does the same seven
 * movements twice. This composes a session from the catalogue instead, out of
 * what the person reported hurting, how that report has moved over two weeks,
 * where they are sitting and how many minutes they said they had.
 *
 * Pure, and that is the point. Every input is an argument, so the composition
 * is reproducible from a date and a journal: two devices with the same history
 * propose the same session, a complaint about « pourquoi ce mouvement » has an
 * answer, and the rules below can be tested rather than believed.
 *
 * What it deliberately does NOT do: predict, score, or claim. It never converts
 * a 0-10 answer into a percentage, an index, or an expected improvement. The
 * rules are thresholds on a number the user typed, nothing more, and the
 * article `renforcement-et-douleur` says what the evidence behind them is worth.
 */

/** At or above this reported score, the plan stays on mobility. */
export const HIGH_PAIN = 6
/** Below this, the zone is treated as calm and can take a second load block. */
export const MODERATE_PAIN = 3
/** Points of improvement over the window that unlock one more strength block. */
export const IMPROVING = 1
/** The window the trend is read over. */
export const TREND_WINDOW = 14
/** How long a reset closer runs when the catalogue does not say otherwise. */
const CLOSER_FALLBACK_S = 30

/**
 * Where the plan looks when nothing has been declared and nothing rated. Not a
 * guess about this person: the three zones the app's own articles are about.
 */
const DEFAULT_ZONES: Zone[] = ['nuque', 'dos', 'lombaires']

export interface ComposeInput {
  today: string
  profile: PainProfile
  entries: PainEntry[]
  /** The catalogue the blocks are drawn from, already place-adapted or not. */
  routines: Routine[]
  exerciseByKey: (key: string) => Exercise | undefined
  place: Place
}

interface Candidate {
  block: Omit<PlanBlock, 'position' | 'forZone'>
  zone: Zone
  discreet: boolean
}

/** The score the plan reasons about: the last answer, else what was declared. */
export function currentScore(
  entries: PainEntry[],
  profile: PainProfile,
  zone: Zone,
): number | null {
  return latestScore(entries, zone) ?? profile.baseline[zone] ?? null
}

/**
 * The zones the session is for, most painful first.
 *
 * Anything ever rated counts, not only what was declared at first run: someone
 * who answered « et les poignets ? » once has told the app something, and
 * dropping it because it was not in the opening questionnaire would be a way of
 * not listening.
 */
export function rankZones(entries: PainEntry[], profile: PainProfile): Zone[] {
  const known = new Set<Zone>([...profile.zones, ...entries.map((e) => e.zone)])
  const scored = [...known]
    .filter((z) => PAIN_ZONES.includes(z))
    .map((zone) => ({ zone, score: currentScore(entries, profile, zone) }))
    .filter((r): r is { zone: Zone; score: number } => r.score !== null)
  if (scored.length === 0) return DEFAULT_ZONES
  // Ties break on the order the app lists zones in, so the result is stable.
  scored.sort((a, b) => b.score - a.score || PAIN_ZONES.indexOf(a.zone) - PAIN_ZONES.indexOf(b.zone))
  return scored.map((r) => r.zone)
}

/**
 * How many strength blocks today's session carries.
 *
 * Zero on a zone reported at six or more: the Cochrane review the app cites
 * found no evidence at all on acute neck pain, and loading something that hurts
 * a lot on the strength of no evidence is exactly what this app says it will
 * not do. One when the zone is calm, two when it is calm and the fortnight has
 * actually come down — which is the whole « le plan s'adapte » claim, and it is
 * measured on the user's own answers or it does not happen.
 */
export function strengthSlots(
  score: number | null,
  slope: number | null,
  minutes: number,
): number {
  if (score !== null && score >= HIGH_PAIN) return 0
  let slots = score === null || score < MODERATE_PAIN ? 1 : 0
  if (slope !== null && slope <= -IMPROVING) slots++
  const cap = minutes >= 6 ? 2 : 1
  return Math.min(slots, cap)
}

/** The goal the composition ends up serving, derived from the same two inputs. */
export function planGoal(score: number | null, slots: number): RoutineGoal {
  if (score !== null && score >= MODERATE_PAIN) return 'pain_relief'
  return slots >= 2 ? 'strength' : 'prevention'
}

/**
 * Every distinct movement the catalogue offers for a zone, in catalogue order.
 * The step carries the name, cue, figure and duration that routine already
 * uses, so a composed session and a shipped routine read identically.
 */
function poolFor(input: ComposeInput, zone: Zone, type: ExerciseType): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const r of input.routines) {
    if (!r.targetZones?.includes(zone)) continue
    for (const s of r.steps) {
      if (seen.has(s.exerciseKey)) continue
      const ex = input.exerciseByKey(s.exerciseKey)
      if (!ex || ex.type !== type) continue
      seen.add(s.exerciseKey)
      out.push({
        zone,
        discreet: ex.discreet,
        block: {
          name: s.name,
          durationS: s.durationS,
          cue: s.cue,
          figureKey: s.figureKey,
          exerciseKey: s.exerciseKey,
          type,
        },
      })
    }
  }
  return out
}

/** Every reset the catalogue holds, whatever zone it was filed under. */
function resetPool(input: ComposeInput): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const r of input.routines) {
    for (const s of r.steps) {
      if (seen.has(s.exerciseKey)) continue
      const ex = input.exerciseByKey(s.exerciseKey)
      if (!ex || ex.type !== 'reset') continue
      seen.add(s.exerciseKey)
      out.push({
        zone: r.targetZones?.[0] ?? 'bien-etre',
        discreet: ex.discreet,
        block: {
          name: s.name,
          durationS: s.durationS,
          cue: s.cue,
          figureKey: s.figureKey,
          exerciseKey: s.exerciseKey,
          type: 'reset',
        },
      })
    }
  }
  return out
}

/**
 * What the place allows. Strict keeps only what nobody notices, full stop —
 * an open space that is served one doorway stretch stops being trusted.
 * Moderate prefers the discreet set and falls back to the whole pool only when
 * the discreet one is empty, so a zone is never dropped for want of discretion.
 */
function allowed(pool: Candidate[], place: Place): Candidate[] {
  const level = DISCRETION[place]
  if (level === 'none') return pool
  const discreet = pool.filter((c) => c.discreet)
  if (level === 'strict') return discreet
  return discreet.length > 0 ? discreet : pool
}

/**
 * Rotate a pool by the number of days since the profile was created, so two
 * consecutive days do not open on the same movement. Deterministic on purpose:
 * a random pick cannot be reproduced when someone asks why they got this.
 */
function rotate<T>(pool: T[], by: number): T[] {
  if (pool.length === 0) return pool
  const n = ((by % pool.length) + pool.length) % pool.length
  return [...pool.slice(n), ...pool.slice(0, n)]
}

function dayIndex(profile: PainProfile, today: string): number {
  const started = profile.startedAt.slice(0, 10)
  const n = daysBetween(started, today)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function label(zone: Zone): string {
  return PAIN_ZONE_LABEL[zone] ?? zone
}

/** The one line the card shows. Factual, and it names the number it used. */
function rationale(
  primary: Zone | null,
  score: number | null,
  slope: number | null,
  slots: number,
  declared: boolean,
): string {
  if (primary === null || !declared) {
    return 'Rien de déclaré pour l’instant : séance d’entretien sur les zones les plus exposées.'
  }
  const zone = label(primary)
  const head = score === null ? `${zone}` : `${zone} à ${Math.round(score)}/10`
  if (slots === 0 && score !== null && score >= HIGH_PAIN) {
    return `${head} : mobilité seule aujourd’hui, aucun mouvement de charge.`
  }
  if (slope !== null && slope <= -IMPROVING) {
    const down = Math.abs(Math.round(slope * 10) / 10)
    return `${head}, en baisse de ${down} point${down >= 2 ? 's' : ''} sur quinze jours : ${
      slots === 0 ? 'mobilité seule' : `${slots} mouvement${slots > 1 ? 's' : ''} de renforcement`
    }.`
  }
  if (slots === 0) return `${head} : mobilité seule aujourd’hui.`
  return `${head} : mobilité, puis ${slots} mouvement${slots > 1 ? 's' : ''} de renforcement.`
}

/**
 * Compose today's session.
 *
 * Order is fixed and it is the order a physio would use: mobility on the zone
 * that hurts, mobility on the second zone if there is one, the load blocks once
 * the tissue is moving, and a reset to close — which is also what makes the
 * end-of-session question land on a body that has stopped moving.
 */
export function composePlan(input: ComposeInput): AdaptivePlan {
  const { today, profile, entries, place } = input
  const ranked = rankZones(entries, profile)
  const primary = ranked[0] ?? null
  const secondary = ranked[1] ?? null
  const declared = profile.zones.length > 0 || entries.length > 0

  const score = primary ? currentScore(entries, profile, primary) : null
  const slope = primary ? trend(entries, primary, today, TREND_WINDOW) : null
  const slots = strengthSlots(score, slope, profile.minutes)
  const goal = planGoal(score, slots)

  const budget = profile.minutes * 60
  const rot = dayIndex(profile, today)

  const zones: Zone[] = secondary && secondary !== primary ? [primary as Zone, secondary] : primary ? [primary] : []

  const mobility = new Map<Zone, Candidate[]>()
  const strength = new Map<Zone, Candidate[]>()
  for (const z of zones) {
    mobility.set(z, rotate(allowed(poolFor(input, z, 'mobility'), place), rot))
    strength.set(z, rotate(allowed(poolFor(input, z, 'strength'), place), rot))
  }
  const closers = rotate(allowed(resetPool(input), place), rot)

  const picked: Candidate[] = []
  const used = new Set<string>()

  // The closer is reserved first: a session that runs out of budget should lose
  // a stretch, never the thing that ends it.
  const closer = closers[0] ?? null
  let left = budget - (closer?.block.durationS ?? 0)

  // Then the load blocks, alternating zones so a second painful zone is not
  // always the one that gets dropped.
  const strengthOrder: Zone[] = zones.length > 1 ? [zones[0] as Zone, zones[1] as Zone] : zones
  const strengthCursor = new Map<Zone, number>(zones.map((z) => [z, 0]))
  for (let i = 0; i < slots; i++) {
    const zone = strengthOrder[i % strengthOrder.length]
    if (!zone) break
    const pool = strength.get(zone) ?? []
    const at = strengthCursor.get(zone) ?? 0
    const c = pool.slice(at).find((x) => !used.has(x.block.exerciseKey))
    if (!c || c.block.durationS > left) continue
    strengthCursor.set(zone, pool.indexOf(c) + 1)
    used.add(c.block.exerciseKey)
    picked.push(c)
    left -= c.block.durationS
  }

  // Whatever budget is left goes to mobility, alternating zones, until the next
  // block would not fit.
  const mobilityCursor = new Map<Zone, number>(zones.map((z) => [z, 0]))
  const mobilityPicked: Candidate[] = []
  let guard = 0
  while (zones.length > 0 && guard++ < 40) {
    const zone = zones[mobilityPicked.length % zones.length] as Zone
    const pool = mobility.get(zone) ?? []
    const at = mobilityCursor.get(zone) ?? 0
    const c = pool.slice(at).find((x) => !used.has(x.block.exerciseKey))
    if (!c) {
      // This zone is exhausted; drop it and keep going with the other one.
      const i = zones.indexOf(zone)
      zones.splice(i, 1)
      continue
    }
    if (c.block.durationS > left) break
    mobilityCursor.set(zone, pool.indexOf(c) + 1)
    used.add(c.block.exerciseKey)
    mobilityPicked.push(c)
    left -= c.block.durationS
  }

  const ordered = [...mobilityPicked, ...picked, ...(closer ? [closer] : [])]
  const blocks: PlanBlock[] = ordered.map((c, i) => ({
    ...c.block,
    position: i + 1,
    forZone: c.block.type === 'reset' ? null : c.zone,
  }))

  const targetZones = [...new Set(blocks.map((b) => b.forZone).filter((z): z is Zone => z !== null))]

  return {
    id: `plan-${today}`,
    localDate: today,
    durationS: blocks.reduce((n, b) => n + b.durationS, 0),
    goal,
    targetZones,
    primaryZone: primary,
    blocks,
    rationale: rationale(primary, score, slope, blocks.filter((b) => b.type === 'strength').length, declared),
  }
}

/**
 * The plan as the player reads it. The player, the routine detail sheet and the
 * completion log all speak `Routine`, and teaching them a second shape would
 * have been three screens of branching for one object.
 */
export const PLAN_SLUG = 'plan'

export function planToRoutine(plan: AdaptivePlan): Routine {
  return {
    id: plan.id,
    slug: PLAN_SLUG,
    title: 'Plan du jour',
    zone: plan.primaryZone ?? 'bureau',
    durationS: plan.durationS,
    summary: plan.rationale,
    accent: 'slate',
    sortOrder: 0,
    goal: plan.goal,
    targetZones: plan.targetZones,
    steps: plan.blocks.map(({ position, name, durationS, cue, figureKey, exerciseKey }) => ({
      position,
      name,
      durationS,
      cue,
      figureKey,
      exerciseKey,
    })),
  }
}

/** Used by the closing question and the card: "ta nuque", "ton haut du dos". */
export function zoneSentence(zone: Zone): string {
  return label(zone)
}

export { CLOSER_FALLBACK_S }
