import { create } from 'zustand'
import { api } from '@/lib/api'
import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { LOCAL_ARTICLES, LOCAL_EXERCISES, LOCAL_ROUTINES } from '@/content'
import type { Article, Exercise, Routine } from '@/lib/types'

/**
 * Content domain store. Seeded from the bundled JSON (§12) so the library and
 * articles work on the very first launch, offline, then refreshed from the API.
 */

interface ContentState {
  routines: Routine[]
  articles: Article[]
  exercises: Exercise[]
  loaded: boolean
  load: () => Promise<void>
  routineBySlug: (slug: string) => Routine | undefined
  articleBySlug: (slug: string) => Article | undefined
  exerciseByKey: (key: string) => Exercise | undefined
}

export const useContentStore = create<ContentState>((set, get) => ({
  routines: LOCAL_ROUTINES,
  articles: LOCAL_ARTICLES,
  exercises: LOCAL_EXERCISES,
  loaded: false,

  load: async () => {
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
    } catch {
      // Keep the cached content.
    }
  },

  routineBySlug: (slug) => get().routines.find((r) => r.slug === slug),
  articleBySlug: (slug) => get().articles.find((a) => a.slug === slug),
  exerciseByKey: (key) => get().exercises.find((e) => e.key === key),
}))
