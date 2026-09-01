import { create } from 'zustand'
import { api, isOffline } from '@/lib/api'
import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import type { Settings } from '@/lib/types'

/**
 * Settings domain store. The device copy is authoritative for the reminder
 * engine (it must work offline, §C5); the server is synced opportunistically.
 */

interface SettingsState {
  settings: Settings
  loaded: boolean
  /** Load the cached copy from device storage on boot. */
  load: () => Promise<void>
  /** Replace with a server copy (called after /me). */
  hydrate: (s: Settings) => void
  /** Apply a partial change locally and push to the server best-effort. */
  update: (patch: Partial<Settings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const s = await getJSON<Settings>(KEYS.settings, DEFAULT_SETTINGS)
    set({ settings: s, loaded: true })
  },

  hydrate: (s) => {
    set({ settings: s, loaded: true })
    void setJSON(KEYS.settings, s)
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    await setJSON(KEYS.settings, next)
    try {
      const saved = await api.put<Settings>('/api/settings', patch)
      set({ settings: saved })
      await setJSON(KEYS.settings, saved)
    } catch (e) {
      // Offline: the local copy stands, the server catches up next time. A real
      // server error (e.g. validation) is surfaced by rethrowing.
      if (!isOffline(e)) throw e
    }
  },
}))
