import { create } from 'zustand'
import { api, clearTokens, hasSessionTokens, onAuthLost, setTokens } from '@/lib/api'
import { KEYS, getJSON, setJSON } from '@/lib/storage'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import type { Settings, User } from '@/lib/types'
import { useSettingsStore } from './settings'

/**
 * Auth domain store. Holds the current user and the "am I logged in" flag the
 * router gates on (§C3). Tokens live in device storage, not here.
 */

type Status = 'loading' | 'authed' | 'anon'

interface AuthState {
  status: Status
  user: User | null
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    displayName: string,
    inviteCode: string,
  ) => Promise<void>
  logout: () => Promise<void>
}

interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

interface MeResponse {
  user: User
  settings: Settings
}

async function applyAuth(res: AuthResponse): Promise<User> {
  await setTokens(res.accessToken, res.refreshToken)
  await setJSON(KEYS.user, res.user)
  try {
    const me = await api.get<MeResponse>('/api/me')
    useSettingsStore.getState().hydrate(me.settings)
    await setJSON(KEYS.user, me.user)
    return me.user
  } catch {
    // Signed in but /me unreachable — proceed with what we have.
    return res.user
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    const cachedUser = await getJSON<User | null>(KEYS.user, null)
    if (!(await hasSessionTokens())) {
      set({ status: 'anon', user: null })
      return
    }
    if (cachedUser) set({ user: cachedUser })
    try {
      const me = await api.get<MeResponse>('/api/me')
      await setJSON(KEYS.user, me.user)
      useSettingsStore.getState().hydrate(me.settings)
      set({ status: 'authed', user: me.user })
    } catch {
      // Still hold a refresh token → authed-but-offline, keep the cached user
      // rather than kicking them out (§C5).
      if ((await hasSessionTokens()) && cachedUser) {
        const settings = await getJSON<Settings>(KEYS.settings, DEFAULT_SETTINGS)
        useSettingsStore.getState().hydrate(settings)
        set({ status: 'authed', user: cachedUser })
      } else {
        set({ status: 'anon', user: null })
      }
    }
  },

  login: async (email, password) => {
    const res = await api.postAnonymous<AuthResponse>('/api/auth/login', { email, password })
    const user = await applyAuth(res)
    set({ status: 'authed', user })
  },

  register: async (email, password, displayName, inviteCode) => {
    const res = await api.postAnonymous<AuthResponse>('/api/auth/register', {
      email,
      password,
      displayName,
      inviteCode,
    })
    const user = await applyAuth(res)
    set({ status: 'authed', user })
  },

  logout: async () => {
    await clearTokens()
    // Deliberately keep settings and the pending event queue (§7).
    set({ status: 'anon', user: null })
  },
}))

// A refresh that fails for good routes back to /login without wiping state.
onAuthLost(() => {
  useAuthStore.setState({ status: 'anon', user: null })
})
