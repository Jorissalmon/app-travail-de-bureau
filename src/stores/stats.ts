import { create } from 'zustand'
import { api } from '@/lib/api'
import { localDate } from '@/lib/date'
import type { Stats } from '@/lib/types'

/** Stats domain store. Read-only; refreshed on demand from /api/stats. */
interface StatsState {
  stats: Stats | null
  range: 'week' | 'month'
  loading: boolean
  load: (range?: 'week' | 'month') => Promise<void>
}

export const useStatsStore = create<StatsState>((set, get) => ({
  stats: null,
  range: 'week',
  loading: false,

  load: async (range) => {
    const r = range ?? get().range
    set({ loading: true, range: r })
    try {
      const stats = await api.get<Stats>(`/api/stats?range=${r}&today=${localDate()}`)
      set({ stats, loading: false })
    } catch {
      // Offline or not yet reachable — keep whatever we had.
      set({ loading: false })
    }
  },
}))
