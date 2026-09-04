import { describe, expect, it } from 'vitest'
import { LOCAL_ARTICLES, LOCAL_EXERCISES, LOCAL_ROUTINES, ZONES } from './index'
import { FIGURE_KEYS, isFigureKey } from '@/components/figures/figureKeys'
import { articleFigures } from '@/lib/markdown'
import { secondFrame } from '@/components/figures/figureFrames'

/**
 * The content is hand-written JSON that the database is generated from, so a
 * typo here ships a routine that renders an empty pastille or lands in a zone
 * no screen offers. Cheaper to catch in a test than in the seed.
 */

const zoneKeys = new Set(ZONES.map((z) => z.zone))

describe('routines', () => {
  it('are not empty', () => {
    expect(LOCAL_ROUTINES.length).toBeGreaterThan(0)
  })

  it('have unique slugs', () => {
    const slugs = LOCAL_ROUTINES.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('sit in a zone the app actually offers', () => {
    for (const r of LOCAL_ROUTINES) {
      expect(zoneKeys, `${r.slug} is in zone "${r.zone}"`).toContain(r.zone)
    }
  })

  it('announce the duration their steps add up to', () => {
    for (const r of LOCAL_ROUTINES) {
      const sum = r.steps.reduce((n, s) => n + s.durationS, 0)
      expect(sum, `${r.slug}`).toBe(r.durationS)
    }
  })

  it('number their steps 1..n', () => {
    for (const r of LOCAL_ROUTINES) {
      expect(r.steps.map((s) => s.position), `${r.slug}`).toEqual(
        r.steps.map((_, i) => i + 1),
      )
    }
  })

  it('only reference figures that exist', () => {
    for (const r of LOCAL_ROUTINES) {
      for (const s of r.steps) {
        expect(isFigureKey(s.figureKey), `${r.slug} / ${s.name}: "${s.figureKey}"`).toBe(true)
      }
    }
  })

  it('only reference an exercise that has a detail entry', () => {
    const keys = new Set(LOCAL_EXERCISES.map((e) => e.key))
    for (const r of LOCAL_ROUTINES) {
      for (const s of r.steps) {
        expect(keys, `${r.slug} / ${s.name}: "${s.exerciseKey}"`).toContain(s.exerciseKey)
      }
    }
  })
})

describe('exercises', () => {
  it('have unique keys', () => {
    const keys = LOCAL_EXERCISES.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('are all used by at least one routine step', () => {
    const used = new Set(LOCAL_ROUTINES.flatMap((r) => r.steps.map((s) => s.exerciseKey)))
    for (const ex of LOCAL_EXERCISES) {
      expect(used, `"${ex.key}" is never referenced by a step`).toContain(ex.key)
    }
  })

  it('only link to articles that exist', () => {
    const slugs = new Set(LOCAL_ARTICLES.map((a) => a.slug))
    for (const ex of LOCAL_EXERCISES) {
      for (const slug of ex.articles) {
        expect(slugs, `${ex.key} -> "${slug}"`).toContain(slug)
      }
    }
  })

  it('each point at least one article, so the sheet never ends on a dead section', () => {
    for (const ex of LOCAL_EXERCISES) {
      expect(ex.articles.length, `${ex.key}`).toBeGreaterThan(0)
    }
  })

  it('give at least one instruction, one adaptation and one muscle worked', () => {
    for (const ex of LOCAL_EXERCISES) {
      expect(ex.steps.length, `${ex.key}`).toBeGreaterThan(0)
      expect(ex.easier.length, `${ex.key}`).toBeGreaterThan(0)
      expect(ex.muscles.length, `${ex.key}`).toBeGreaterThan(0)
      expect(ex.avoid.length, `${ex.key}`).toBeGreaterThan(0)
    }
  })
})

describe('two-position figures', () => {
  it('pair keys that both exist', () => {
    for (const key of FIGURE_KEYS) {
      const second = secondFrame(key)
      if (second !== null) expect(isFigureKey(second), `${key} -> ${second}`).toBe(true)
    }
  })

  it('are only declared for exercises a routine actually uses', () => {
    const used = new Set(LOCAL_ROUTINES.flatMap((r) => r.steps.map((s) => s.figureKey)))
    for (const key of FIGURE_KEYS) {
      if (secondFrame(key) !== null) expect(used, `${key} has a second frame`).toContain(key)
    }
  })
})

describe('articles', () => {
  it('have unique slugs', () => {
    const slugs = LOCAL_ARTICLES.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('only place figures that exist', () => {
    for (const a of LOCAL_ARTICLES) {
      for (const key of articleFigures(a.bodyMd)) {
        expect(isFigureKey(key), `${a.slug}: "${key}"`).toBe(true)
      }
    }
  })

  it('are illustrated', () => {
    for (const a of LOCAL_ARTICLES) {
      expect(articleFigures(a.bodyMd).length, `${a.slug}`).toBeGreaterThan(0)
    }
  })
})

describe('zones', () => {
  it('each hold at least one routine, or the card leads nowhere', () => {
    for (const z of ZONES) {
      const count = LOCAL_ROUTINES.filter((r) => r.zone === z.zone).length
      expect(count, `zone "${z.zone}"`).toBeGreaterThan(0)
    }
  })

  it('use a figure that exists for their card', () => {
    for (const z of ZONES) {
      expect(FIGURE_KEYS, `zone "${z.zone}"`).toContain(z.figureKey)
    }
  })
})
