import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The alarm's timers, tested where there is exactly one copy of the module.
 *
 * Driving this in a browser proved unreliable for a reason worth recording: a
 * dev server that has hot-reloaded a file serves two instances of it, each with
 * its own module-level timer handle, so a `stopAlerting` called through one of
 * them cannot clear an interval armed by the other. That looked exactly like a
 * bug where a ringing alarm survived being answered. Here there is one module,
 * one set of timers, and fake clocks — so the assertion means what it says.
 */

// Device storage is Capacitor Preferences; in Node it has no implementation.
const store = new Map<string, string>()
vi.mock('@/lib/storage', () => ({
  KEYS: { alertMode: 'reminders.alertMode', alertVolume: 'reminders.alertVolume' },
  getRaw: async (k: string) => store.get(k) ?? null,
  setRaw: async (k: string, v: string) => void store.set(k, v),
}))

// Le pont natif n'a pas d'implémentation hors appareil.
vi.mock('./audiofocus', () => ({
  duckOthers: async () => undefined,
  stopDucking: async () => undefined,
}))

const {
  loadAlertMode,
  setAlertMode,
  startAlerting,
  stopAlerting,
  alertMode,
  alertVolume,
  clampVolume,
  loadAlertVolume,
  setAlertVolume,
  DEFAULT_VOLUME,
  MIN_VOLUME,
  MAX_VOLUME,
} = await import('./alert')

beforeEach(() => {
  vi.useFakeTimers()
  store.clear()
})

afterEach(() => {
  stopAlerting()
  vi.useRealTimers()
})

describe('alert mode', () => {
  it('is silent until someone chooses otherwise', async () => {
    expect(await loadAlertMode()).toBe('silent')
  })

  it('survives a restart, because it is written to the device', async () => {
    await setAlertMode('repeat')
    expect(await loadAlertMode()).toBe('repeat')
  })

  it('falls back to silent on a value it does not recognise', async () => {
    store.set('reminders.alertMode', 'assourdissant')
    expect(await loadAlertMode()).toBe('silent')
    expect(alertMode()).toBe('silent')
  })
})

describe('ringing', () => {
  it('arms nothing at all when silent', async () => {
    await setAlertMode('silent')
    startAlerting()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('arms nothing that outlives the sound when set to ring once', async () => {
    await setAlertMode('once')
    startAlerting()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps a repeat armed until it is answered', async () => {
    await setAlertMode('repeat')
    startAlerting()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })

  it('stops for good once answered — the bug this file exists for', async () => {
    await setAlertMode('repeat')
    startAlerting()
    stopAlerting()
    expect(vi.getTimerCount()).toBe(0)
    // And nothing reschedules itself behind our back.
    vi.advanceTimersByTime(5 * 60_000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('gives up on its own rather than ring all afternoon', async () => {
    await setAlertMode('repeat')
    startAlerting()
    vi.advanceTimersByTime(5 * 60_000 + 1_000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('never stacks two sets of timers when a second reminder lands', async () => {
    await setAlertMode('repeat')
    startAlerting()
    const armed = vi.getTimerCount()
    startAlerting()
    expect(vi.getTimerCount()).toBe(armed)
  })
})

describe('alert volume', () => {
  it('starts at the default, loud enough to be heard over a room', async () => {
    expect(await loadAlertVolume()).toBe(DEFAULT_VOLUME)
    expect(DEFAULT_VOLUME).toBeGreaterThanOrEqual(70)
  })

  it('survives a restart', async () => {
    await setAlertVolume(40)
    expect(await loadAlertVolume()).toBe(40)
    expect(alertVolume()).toBe(40)
  })

  it('never lands on silence: that is what the mode is for', () => {
    expect(clampVolume(0)).toBe(MIN_VOLUME)
    expect(clampVolume(-50)).toBe(MIN_VOLUME)
    expect(clampVolume(3)).toBe(MIN_VOLUME)
  })

  it('never goes past the top of the scale', () => {
    expect(clampVolume(100)).toBe(MAX_VOLUME)
    expect(clampVolume(9999)).toBe(MAX_VOLUME)
  })

  it('snaps to the step the slider offers', () => {
    expect(clampVolume(44)).toBe(40)
    expect(clampVolume(46)).toBe(50)
  })

  it('falls back to the default on a stored value that is not a number', async () => {
    store.set('reminders.alertVolume', 'fort')
    expect(await loadAlertVolume()).toBe(DEFAULT_VOLUME)
  })
})
