import { create } from 'zustand'
import { api } from '@/lib/api'
import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { LOCAL_ARTICLES, LOCAL_EXERCISES, LOCAL_ROUTINES } from '@/content'
import type { Article, Exercise, Routine } from '@/lib/types'
import {
  buildCatalogue,
  customRoutines,
  loadCustomRoutines,
  materialise,
} from '@/features/routines/custom'
import { adaptToPlace, loadPlace, place } from '@/features/place/place'

/**
 * Content domain store. Seeded from the bundled JSON (§12) so the library and
 * articles work on the very first launch, offline, then refreshed from the API.
 */

interface ContentState {
  routines: Routine[]
  articles: Article[]
  exercises: Exercise[]
  /** The shipped catalogue as it reads where the user is working today. */
  adapted: Routine[]
  /** The user's own, rebuilt from the catalogue into full routines. */
  mine: Routine[]
  loaded: boolean
  load: () => Promise<void>
  /** Re-read the user's routines after the builder has changed one. */
  refreshMine: () => Promise<void>
  /** Re-derive what the catalogue offers after the place has changed. */
  refreshPlace: () => Promise<void>
  routineBySlug: (slug: string) => Routine | undefined
  articleBySlug: (slug: string) => Article | undefined
  exerciseByKey: (key: string) => Exercise | undefined
}

type Setter = (partial: Partial<ContentState>) => void
type Getter = () => ContentState

async function rebuildMine(set: Setter, get: Getter): Promise<void> {
  const entries = buildCatalogue(get().routines)
  set({ mine: customRoutines().map((c) => materialise(c, entries)) })
}

/**
 * The catalogue as it should read where the user is today. Applied here rather
 * than in each screen, so the library, the detail page, the player and the
 * break prompt all agree without any of them knowing the rule.
 *
 * Only the shipped routines are adapted. One the user composed is their own
 * decision — quietly removing a movement they chose would be worse than
 * proposing it in an open space.
 */
function rebuildAdapted(set: Setter, get: Getter): void {
  const where = place()
  set({ adapted: get().routines.map((r) => adaptToPlace(r, where, get().exerciseByKey)) })
}

export const useContentStore = create<ContentState>((set, get) => ({
  routines: LOCAL_ROUTINES,
  articles: LOCAL_ARTICLES,
  exercises: LOCAL_EXERCISES,
  adapted: LOCAL_ROUTINES,
  mine: [],
  loaded: false,

  refreshMine: () => rebuildMine(set, get),

  refreshPlace: async () => {
    await loadPlace()
    rebuildAdapted(set, get)
  },

  load: async () => {
    await loadPlace()
    await loadCustomRoutines()
    // Show cached-or-bundled immediately.
    const cachedRoutines = await getJSON<Routine[]>(KEYS.routines, LOCAL_ROUTINES)
    const cachedArticles = await getJSON<Article[]>(KEYS.articles, LOCAL_ARTICLES)
    const cachedExercises = await getJSON<Exercise[]>(KEYS.exercises, LOCAL_EXERCISES)
    set({
      routines: cachedRoutines,
      articles: cachedArticles,
      exercises: cachedExercises,
      loaded: true,
    })
    rebuildAdapted(set, get)
    await rebuildMine(set, get)

    // Refresh in the background; failures are silent (§C5).
    try {
      const [routines, articles, exercises] = await Promise.all([
        api.get<Routine[]>('/api/routines'),
        api.get<Article[]>('/api/articles'),
        api.get<Exercise[]>('/api/exercises'),
      ])
      if (routines.length) {
        set({ routines })
        await setJSON(KEYS.routines, routines)
      }
      if (articles.length) {
        set({ articles })
        await setJSON(KEYS.articles, articles)
      }
      if (exercises.length) {
        set({ exercises })
        await setJSON(KEYS.exercises, exercises)
      }
      // The catalogue may have moved under the user's routines: rebuild them
      // against what just arrived.
      await rebuildMine(set, get)
    } catch {
      // Keep the cached content.
    }
  },

  // A user's routine is looked up first: its slug can never collide with a
  // shipped one, and this is what lets RoutineDetail and the player draw it
  // without knowing it was composed rather than shipped.
  // Read from the lists, never adapted here: adaptToPlace builds a new object
  // when it trims, and a selector that returns a fresh identity on every render
  // sends zustand into an infinite update loop.
  routineBySlug: (slug) =>
    get().mine.find((r) => r.slug === slug) ?? get().adapted.find((r) => r.slug === slug),
  articleBySlug: (slug) => get().articles.find((a) => a.slug === slug),
  exerciseByKey: (key) => get().exercises.find((e) => e.key === key),
}))
