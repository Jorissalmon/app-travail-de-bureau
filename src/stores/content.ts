import { create } from 'zustand'
import { api } from '@/lib/api'
import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { LOCAL_ARTICLES, LOCAL_ROUTINES } from '@/content'
import type { Article, Routine } from '@/lib/types'

/**
 * Content domain store. Seeded from the bundled JSON (§12) so the library and
 * articles work on the very first launch, offline, then refreshed from the API.
 */

interface ContentState {
  routines: Routine[]
  articles: Article[]
  loaded: boolean
  load: () => Promise<void>
  routineBySlug: (slug: string) => Routine | undefined
  articleBySlug: (slug: string) => Article | undefined
}

export const useContentStore = create<ContentState>((set, get) => ({
  routines: LOCAL_ROUTINES,
  articles: LOCAL_ARTICLES,
  loaded: false,

  load: async () => {
    // Show cached-or-bundled immediately.
    const cachedRoutines = await getJSON<Routine[]>(KEYS.routines, LOCAL_ROUTINES)
    const cachedArticles = await getJSON<Article[]>(KEYS.articles, LOCAL_ARTICLES)
    set({ routines: cachedRoutines, articles: cachedArticles, loaded: true })

    // Refresh in the background; failures are silent (§C5).
    try {
      const [routines, articles] = await Promise.all([
        api.get<Routine[]>('/api/routines'),
        api.get<Article[]>('/api/articles'),
      ])
      if (routines.length) {
        set({ routines })
        await setJSON(KEYS.routines, routines)
      }
      if (articles.length) {
        set({ articles })
        await setJSON(KEYS.articles, articles)
      }
    } catch {
      // Keep the cached content.
    }
  },

  routineBySlug: (slug) => get().routines.find((r) => r.slug === slug),
  articleBySlug: (slug) => get().articles.find((a) => a.slug === slug),
}))
