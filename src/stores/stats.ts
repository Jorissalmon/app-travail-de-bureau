import { create } from 'zustand'
import { api } from '@/lib/api'
import { localDate } from '@/lib/date'
import { readCompletionJournal, readEventJournal } from '@/features/reminders/events'
import { buildLocalStats } from '@/features/session/localStats'
import { readDayLog } from '@/features/session/daylog'
import { freezeSpent, freezesLeft, rangeToSpan, type FreezeSeen } from '@/features/session/stats'
import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { trackNow } from '@/features/analytics/events'
import type { Stats } from '@/lib/types'
import { useSettingsStore } from './settings'

/**
 * Stats domain store. Read-only.
 *
 * The device answers first, always, from its own journal: the screen is drawn
 * before any request goes out, it is drawn offline, and it is drawn for someone
 * who never made an account. The server copy then replaces it when it arrives —
 * it holds the whole history, where the journal keeps forty-five days.
 */
interface StatsState {
  stats: Stats | null
  range: 'week' | 'month'
  loading: boolean
  /** True while the numbers on screen are the device's own. */
  local: boolean
  load: (range?: 'week' | 'month') => Promise<void>
}

/**
 * Announce a freeze the moment the journal shows one was spent, and exactly
 * once. Silent on a new month: the budget refilling is not an event.
 */
async function reportFreeze(
  days: { localDate: string; stands: number; reminders: number }[],
  today: string,
  weekdays: number[],
): Promise<void> {
  try {
    const left = freezesLeft(days, today, { weekdays })
    const seen = await getJSON<FreezeSeen | null>(KEYS.freezesSeen, null)
    if (freezeSpent(seen, today, left)) trackNow({ name: 'streak_freeze_used', left })
    await setJSON(KEYS.freezesSeen, { month: today.slice(0, 7), left })
  } catch {
    /* Reporting the streak must never be able to blank the tracking screen. */
  }
}

export const useStatsStore = create<StatsState>((set, get) => ({
  stats: null,
  range: 'week',
  loading: false,
  local: true,

  load: async (range) => {
    const r = range ?? get().range
    set({ loading: true, range: r })

    const today = localDate()
    try {
      const [events, completions, sessions] = await Promise.all([
        readEventJournal(),
        readCompletionJournal(),
        readDayLog(),
      ])
      const weekdays = useSettingsStore.getState().settings.weekdays
      const built = buildLocalStats({
          events,
          completions,
          sessions,
          today,
          now: new Date().toISOString(),
        span: rangeToSpan(r),
        weekdays,
      })
      set({ stats: built, local: true })
      await reportFreeze(built.standsByDay, today, weekdays)
    } catch {
      /* A corrupted journal must not blank the screen; the server may still answer. */
    }

    try {
      const stats = await api.get<Stats>(`/api/stats?range=${r}&today=${today}`)
      set({ stats, local: false, loading: false })
    } catch {
      // Offline, or no account: the device's own numbers stand. This is not a
      // degraded state to apologise for — it is the whole record for anyone who
      // never signed up.
      set({ loading: false })
    }
  },
}))
