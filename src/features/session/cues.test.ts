import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real module reaches for @capacitor/preferences, which needs a webview.
vi.mock('@/lib/storage', () => {
  const store = new Map<string, string>()
  return {
    KEYS: { playerSound: 'player.sound' },
    getRaw: (k: string) => Promise.resolve(store.get(k) ?? null),
    setRaw: (k: string, v: string) => {
      store.set(k, v)
      return Promise.resolve()
    },
  }
})

import { cueEnd, cueStep, cueTick, cuesEnabled, loadCues, setCues } from './cues'

/** Every tone that reached start(), instead of a sound. */
let played: { type: string; frequency: number }[] = []

class FakeParam {
  setValueAtTime() {
    return this
  }
  linearRampToValueAtTime() {
    return this
  }
  exponentialRampToValueAtTime() {
    return this
  }
}

class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = { id: 'destination' }
  resume() {
    return Promise.resolve()
  }
  createGain() {
    return { gain: new FakeParam(), connect: (next: unknown) => next }
  }
  createOscillator() {
    const osc = {
      type: '',
      frequency: { value: 0 },
      connect: (next: unknown) => next,
      start: () => played.push({ type: osc.type, frequency: osc.frequency.value }),
      stop: () => {},
    }
    return osc
  }
}

beforeEach(() => {
  played = []
  ;(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext
})

afterEach(() => {
  delete (globalThis as { AudioContext?: unknown }).AudioContext
})

describe('cues', () => {
  it('is on until the device says otherwise', async () => {
    expect(await loadCues()).toBe(true)
    expect(cuesEnabled()).toBe(true)
  })

  it('gives each moment its own tone', () => {
    cueTick()
    cueStep()
    cueEnd()
    expect(played.map((p) => p.frequency)).toEqual([880, 1175, 1568])
    expect(played.every((p) => p.type === 'sine')).toBe(true)
  })

  it('stays silent once turned off, and sounds again once turned back on', async () => {
    await setCues(false)
    expect(cuesEnabled()).toBe(false)
    cueTick()
    cueStep()
    cueEnd()
    expect(played).toHaveLength(0)

    await setCues(true)
    cueTick()
    expect(played).toHaveLength(1)
  })

  it('remembers the choice across a reload', async () => {
    await setCues(false)
    expect(await loadCues()).toBe(false)
    await setCues(true)
    expect(await loadCues()).toBe(true)
  })

  it('does nothing where there is no Web Audio at all', () => {
    delete (globalThis as { AudioContext?: unknown }).AudioContext
    expect(() => {
      cueTick()
      cueStep()
      cueEnd()
    }).not.toThrow()
  })
})
