import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The capability probe, which decides what the settings screen is allowed to
 * promise. An OTA bundle lands on whichever APK is installed, so «peut-on
 * baisser la musique» is a question about the shell, not about the code.
 */

const platform = { native: true, name: 'android' }
vi.mock('@/lib/platform', () => ({
  isNative: () => platform.native,
  platform: () => platform.name,
}))

interface Header {
  name: string
  methods: { name: string }[]
}
const bridge: { PluginHeaders?: Header[] } = {}
vi.mock('@capacitor/core', () => ({
  Capacitor: bridge,
  registerPlugin: () => ({
    duckOthers: async () => undefined,
    stopDucking: async () => undefined,
  }),
}))

async function load() {
  vi.resetModules()
  return import('./audiofocus')
}

afterEach(() => {
  delete bridge.PluginHeaders
  delete (navigator as { audioSession?: unknown }).audioSession
  platform.native = true
  platform.name = 'android'
})

describe('canDuck', () => {
  it('says yes when the shell was compiled with duckOthers', async () => {
    bridge.PluginHeaders = [
      { name: 'ScreenWake', methods: [{ name: 'keepAwake' }, { name: 'duckOthers' }] },
    ]
    const { canDuck } = await load()
    expect(canDuck()).toBe(true)
  })

  // The case the user hit: the bundle knows how to ask, the APK it landed on
  // has no one to ask. The call rejects and is swallowed, so nothing but this
  // probe can tell the screen not to promise ducking.
  it('says no on an older shell whose plugin predates it', async () => {
    bridge.PluginHeaders = [{ name: 'ScreenWake', methods: [{ name: 'keepAwake' }] }]
    const { canDuck } = await load()
    expect(canDuck()).toBe(false)
  })

  it('says no when the bridge lists no ScreenWake at all', async () => {
    bridge.PluginHeaders = [{ name: 'LocalNotifications', methods: [{ name: 'schedule' }] }]
    const { canDuck } = await load()
    expect(canDuck()).toBe(false)
  })

  // In a browser there are no headers to read; the answer is no, not a crash.
  it('says no in the browser', async () => {
    platform.native = false
    platform.name = 'web'
    const { canDuck } = await load()
    expect(canDuck()).toBe(false)
  })

  // The day the WebView ships the Audio Session API, ducking stops needing an
  // APK — and the probe must notice before the plugin does.
  it('says yes on an engine that has navigator.audioSession, whatever the shell', async () => {
    platform.native = false
    platform.name = 'web'
    ;(navigator as { audioSession?: unknown }).audioSession = { type: 'auto' }
    const { canDuck } = await load()
    expect(canDuck()).toBe(true)
  })
})
