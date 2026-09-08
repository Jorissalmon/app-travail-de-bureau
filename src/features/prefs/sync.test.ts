import { describe, expect, it, vi } from 'vitest'

/**
 * The merge rule, which is the only place two devices can lose work.
 */

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), put: vi.fn() },
  isOffline: () => false,
}))
vi.mock('@/lib/storage', () => ({
  KEYS: {
    customRoutines: 'routines.custom',
    stepDurations: 'player.durations',
    playerSound: 'player.sound',
    prefsUpdatedAt: 'prefs.updatedAt',
  },
  getRaw: async () => null,
  setRawQuietly: async () => undefined,
  removeQuietly: async () => undefined,
  watchStorage: () => () => undefined,
}))

const { merge } = await import('./sync')

const KEY_ROUTINES = 'routines.custom'
const KEY_DURATIONS = 'player.durations'

const routine = (slug: string, title: string) =>
  JSON.stringify([{ slug, title, steps: [], createdAt: '2026-01-01T00:00:00.000Z' }])

function slugs(raw: string | undefined): string[] {
  return raw === undefined
    ? []
    : (JSON.parse(raw) as { slug: string }[]).map((r) => r.slug).sort()
}

describe('merge', () => {
  it('takes the server copy of a plain preference when the server is newer', () => {
    const out = merge(
      { [KEY_DURATIONS]: '{"debout":{"1":60}}' },
      { [KEY_DURATIONS]: '{"debout":{"1":90}}' },
      true,
    )
    expect(out[KEY_DURATIONS]).toBe('{"debout":{"1":90}}')
  })

  it('keeps the device copy when the device is newer', () => {
    const out = merge(
      { [KEY_DURATIONS]: '{"debout":{"1":60}}' },
      { [KEY_DURATIONS]: '{"debout":{"1":90}}' },
      false,
    )
    expect(out[KEY_DURATIONS]).toBe('{"debout":{"1":60}}')
  })

  it('carries a preference the other side has never heard of, whichever is newer', () => {
    expect(merge({ [KEY_DURATIONS]: '{"a":1}' }, {}, true)[KEY_DURATIONS]).toBe('{"a":1}')
    expect(merge({}, { [KEY_DURATIONS]: '{"a":1}' }, false)[KEY_DURATIONS]).toBe('{"a":1}')
  })

  // The case worth having a rule for: routines built on a phone with no
  // account, then signed into an account a laptop has already synced. Plain
  // newer-wins would delete work that exists nowhere else.
  it('unions routines by slug rather than letting the newer side delete the other', () => {
    const out = merge(
      { [KEY_ROUTINES]: routine('perso-aaa', 'Depuis le téléphone') },
      { [KEY_ROUTINES]: routine('perso-bbb', 'Depuis le portable') },
      true,
    )
    expect(slugs(out[KEY_ROUTINES])).toEqual(['perso-aaa', 'perso-bbb'])
  })

  it('unions the same way when the device is the newer side', () => {
    const out = merge(
      { [KEY_ROUTINES]: routine('perso-aaa', 'Depuis le téléphone') },
      { [KEY_ROUTINES]: routine('perso-bbb', 'Depuis le portable') },
      false,
    )
    expect(slugs(out[KEY_ROUTINES])).toEqual(['perso-aaa', 'perso-bbb'])
  })

  it('lets the device win a routine both sides know, so an edit is not undone', () => {
    const out = merge(
      { [KEY_ROUTINES]: routine('perso-aaa', 'Renommée ici') },
      { [KEY_ROUTINES]: routine('perso-aaa', 'Ancien nom') },
      true,
    )
    const parsed = JSON.parse(out[KEY_ROUTINES]!) as { title: string }[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.title).toBe('Renommée ici')
  })

  it('survives a corrupted routine list on either side', () => {
    const out = merge(
      { [KEY_ROUTINES]: 'pas du json' },
      { [KEY_ROUTINES]: routine('perso-bbb', 'Depuis le portable') },
      true,
    )
    expect(slugs(out[KEY_ROUTINES])).toEqual(['perso-bbb'])
  })

  it('never invents a key neither side holds', () => {
    expect(merge({}, {}, true)).toEqual({})
  })
})
