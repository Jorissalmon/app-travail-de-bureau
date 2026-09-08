import { LOCAL_EXERCISES, LOCAL_ROUTINES, PAIN_ZONES } from './index'
import type { Article, Exercise, Routine, Zone } from '@/lib/types'

/**
 * Make what the server sent usable by the app that is running now.
 *
 * The app updates over the air, in seconds. The API and the database update
 * when someone deploys and runs a migration, which can be hours later or never
 * — the `DB migrate` workflow has been failing on a missing secret for days.
 * So there is always a window where a phone runs the new code against an API
 * that predates it, and that window is not an edge case: it is every single
 * release, for every user, until the backend catches up.
 *
 * The pivot made that window fatal. `/api/routines` did not yet return `goal`
 * or `targetZones`, the content store overwrote the bundled catalogue with what
 * it got, and the plan composer then read `routine.targetZones.includes(...)`
 * on undefined — a TypeError on the home screen, cached to storage, surviving
 * the next launch. An offline-first app that breaks the moment it comes online
 * is worse than one with no API at all.
 *
 * The fill values are not invented. `src/content/*.json` is the very file the
 * seed is generated from, so a field missing from the wire is taken from the
 * bundled entry with the same slug — the same value the database will hold once
 * it is migrated. Only a slug the bundle has never heard of falls back to a
 * derived default, and that default is the conservative one.
 */

const localRoutines = new Map(LOCAL_ROUTINES.map((r) => [r.slug, r]))
const localExercises = new Map(LOCAL_EXERCISES.map((e) => [e.key, e]))

function isZone(v: unknown): v is Zone {
  return typeof v === 'string' && v.length > 0
}

/**
 * A routine the bundle does not know: content added to the database after this
 * build shipped. `prevention` claims the least, and a body zone targets itself
 * so it is at least reachable by the plan rather than invisible to it.
 */
function derive(r: Routine): Pick<Routine, 'goal' | 'targetZones'> {
  return {
    goal: 'prevention',
    targetZones: PAIN_ZONES.includes(r.zone) ? [r.zone] : [],
  }
}

export function reconcileRoutines(remote: Routine[]): Routine[] {
  return remote.map((r) => {
    const known = localRoutines.get(r.slug)
    const fallback = known ?? derive(r)
    // An empty array counts as absent: a migrated database that has not been
    // re-seeded holds target_zones = '{}', which would silently hide the
    // routine from every plan rather than crash — the worse failure, because
    // nobody reports it.
    const targetZones =
      Array.isArray(r.targetZones) && r.targetZones.length > 0 && r.targetZones.every(isZone)
        ? r.targetZones
        : fallback.targetZones
    const goal = r.goal ?? fallback.goal
    // The steps are the server's: content genuinely changes there, and that is
    // the whole point of reading the API at all.
    return { ...r, goal, targetZones }
  })
}

export function reconcileExercises(remote: Exercise[]): Exercise[] {
  return remote.map((e) => ({
    ...e,
    // Unknown to the bundle and untyped on the wire: mobility is the safe
    // reading. Calling something strength that the app has never seen would
    // let the plan load a zone that hurts on no information at all.
    type: e.type ?? localExercises.get(e.key)?.type ?? 'mobility',
  }))
}

/**
 * Articles gained no field, so this only guards the shape: a body that is not
 * a string would break the markdown renderer on the article screen.
 */
export function reconcileArticles(remote: Article[]): Article[] {
  return remote.filter((a) => typeof a?.slug === 'string' && typeof a?.bodyMd === 'string')
}
