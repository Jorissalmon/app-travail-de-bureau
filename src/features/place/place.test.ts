import { describe, expect, it } from 'vitest'
import { adaptToPlace, hiddenAtOffice, suitsPlace } from './place'
import type { Exercise, Routine } from '@/lib/types'

/**
 * The office set is a view of the catalogue, not a second catalogue. These
 * tests pin the two rules that make it safe: a routine never comes back empty,
 * and nothing is ever removed without the screen being able to say how much.
 */

const exercise = (key: string, discreet: boolean): Exercise => ({
  key,
  title: key,
  steps: ['…'],
  tips: [],
  easier: '…',
  muscles: ['…'],
  avoid: '…',
  articles: ['a'],
  discreet,
})

const CATALOGUE: Record<string, Exercise> = {
  assis: exercise('assis', true),
  souffle: exercise('souffle', true),
  fente: exercise('fente', false),
  porte: exercise('porte', false),
}
const byKey = (key: string) => CATALOGUE[key]

function routine(keys: string[]): Routine {
  return {
    id: 'r',
    slug: 'r',
    title: 'R',
    zone: 'bureau',
    durationS: keys.length * 30,
    summary: '',
    accent: 'lime',
    sortOrder: 1,
    steps: keys.map((exerciseKey, i) => ({
      position: i + 1,
      name: exerciseKey,
      durationS: 30,
      cue: '',
      figureKey: 'marche',
      exerciseKey,
    })),
  }
}

describe('adaptToPlace', () => {
  it('changes nothing at home', () => {
    const r = routine(['assis', 'fente'])
    expect(adaptToPlace(r, 'maison', byKey).steps).toHaveLength(2)
  })

  it('drops what an open space will not allow', () => {
    const adapted = adaptToPlace(routine(['assis', 'fente', 'souffle']), 'bureau', byKey)
    expect(adapted.steps.map((s) => s.exerciseKey)).toEqual(['assis', 'souffle'])
  })

  it('renumbers the steps it keeps, so the player counts them right', () => {
    const adapted = adaptToPlace(routine(['fente', 'assis', 'souffle']), 'bureau', byKey)
    expect(adapted.steps.map((s) => s.position)).toEqual([1, 2])
  })

  it('recomputes the duration it announces', () => {
    const adapted = adaptToPlace(routine(['assis', 'fente', 'souffle']), 'bureau', byKey)
    expect(adapted.durationS).toBe(60)
  })

  it('leaves a routine whole rather than empty it', () => {
    // Every movement is one for home: an empty routine helps nobody.
    const adapted = adaptToPlace(routine(['fente', 'porte']), 'bureau', byKey)
    expect(adapted.steps).toHaveLength(2)
  })

  it('leaves a routine whole rather than gut it past half', () => {
    // Two of five would survive. A five-movement routine served as two is a
    // different routine, not an adapted one.
    const r = routine(['fente', 'porte', 'fente', 'assis', 'souffle'])
    expect(adaptToPlace(r, 'bureau', byKey)).toBe(r)
  })

  it('still trims when exactly half survives', () => {
    const adapted = adaptToPlace(routine(['assis', 'souffle', 'fente', 'porte']), 'bureau', byKey)
    expect(adapted.steps).toHaveLength(2)
  })

  it('leaves an already-discreet routine untouched', () => {
    const r = routine(['assis', 'souffle'])
    expect(adaptToPlace(r, 'bureau', byKey)).toBe(r)
  })
})

describe('suitsPlace', () => {
  it('accepts everything at home', () => {
    expect(suitsPlace(routine(['fente', 'porte']), 'maison', byKey)).toBe(true)
  })

  it('accepts a routine the office set can trim', () => {
    expect(suitsPlace(routine(['assis', 'souffle', 'fente']), 'bureau', byKey)).toBe(true)
  })

  it('rejects one the office would gut', () => {
    expect(suitsPlace(routine(['fente', 'porte', 'fente', 'assis']), 'bureau', byKey)).toBe(false)
  })
})

describe('hiddenAtOffice', () => {
  it('counts nothing at home', () => {
    expect(hiddenAtOffice(routine(['assis', 'fente']), 'maison', byKey)).toBe(0)
  })

  it('counts what the office set leaves out', () => {
    // Deux mouvements sur quatre survivent : la routine est bien rognee.
    expect(hiddenAtOffice(routine(['assis', 'souffle', 'fente', 'porte']), 'bureau', byKey)).toBe(2)
  })

  it('counts nothing when nothing was actually removed', () => {
    // adaptToPlace keeps these whole, so claiming two are hidden would be a lie.
    expect(hiddenAtOffice(routine(['fente', 'porte']), 'bureau', byKey)).toBe(0)
  })

  it('counts nothing for a routine left whole by the half rule', () => {
    expect(hiddenAtOffice(routine(['fente', 'porte', 'fente', 'assis']), 'bureau', byKey)).toBe(0)
  })
})
