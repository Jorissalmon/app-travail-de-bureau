import { create } from 'zustand'
import { KEYS, getRaw, setRaw } from '@/lib/storage'

/**
 * Whether the app has ever introduced itself on this device.
 *
 * There was no first run at all: the app opened on a login form with an invite
 * code, then on a screen with one button. Nothing said what it does, why thirty
 * minutes, or that without the Android grants it cannot do anything — and the
 * five graded articles that answer all of it sat behind a tab nobody opens on
 * day one.
 *
 * Device-local, and deliberately not part of `Settings`: /api/me replaces that
 * object wholesale, and the welcome is a property of this phone, not of the
 * account. A second device gets the introduction again, which is right.
 */

type Status = 'loading' | 'todo' | 'done'

interface OnboardingState {
  status: Status
  load: () => Promise<void>
  complete: () => Promise<void>
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  status: 'loading',

  load: async () => {
    const seen = await getRaw(KEYS.onboarded)
    set({ status: seen === '1' ? 'done' : 'todo' })
  },

  complete: async () => {
    set({ status: 'done' })
    await setRaw(KEYS.onboarded, '1')
  },
}))
