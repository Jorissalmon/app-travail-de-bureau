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
  KEYS: { alertMode: 'reminders.alertMode' },
  getRaw: async (k: string) => store.get(k) ?? null,
  setRaw: async (k: string, v: string) => void store.set(k, v),
}))

const { loadAlertMode, setAlertMode, startAlerting, stopAlerting, alertMode } = await import(
  './alert'
)

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
