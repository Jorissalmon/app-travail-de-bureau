import { describe, expect, it } from 'vitest'
import { GOALS, LOCAL_ARTICLES, LOCAL_EXERCISES, LOCAL_ROUTINES, PAIN_ZONES, TYPES, ZONES } from './index'
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

  it('declare a goal the plan knows how to serve', () => {
    for (const r of LOCAL_ROUTINES) {
      expect(GOALS, `${r.slug}`).toContain(r.goal)
    }
  })

  it('target zones the app actually offers, and at least one', () => {
    for (const r of LOCAL_ROUTINES) {
      expect(r.targetZones.length, `${r.slug} targets nothing`).toBeGreaterThan(0)
      for (const z of r.targetZones) {
        expect(zoneKeys, `${r.slug} targets "${z}"`).toContain(z)
      }
    }
  })

  it('draw a movement the same way everywhere it appears', () => {
    // Two routines showing the same movement under two different drawings is
    // the kind of thing only a reader notices, and it reads as a bug.
    const drawn = new Map<string, string>()
    for (const r of LOCAL_ROUTINES) {
      for (const s of r.steps) {
        const first = drawn.get(s.exerciseKey)
        if (first === undefined) drawn.set(s.exerciseKey, s.figureKey)
        else expect(s.figureKey, `${s.exerciseKey} in ${r.slug}`).toBe(first)
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

  it('declare a type the plan can dose on', () => {
    for (const ex of LOCAL_EXERCISES) {
      expect(TYPES, `${ex.key}`).toContain(ex.type)
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

describe('the adaptive plan has something to compose with', () => {
  const byKey = new Map(LOCAL_EXERCISES.map((e) => [e.key, e]))

  it('holds strength movements for every zone the plan can be asked to load', () => {
    // Below this the plan would repeat the same movement two days running on
    // the zone that hurts, which is the abandonment case the pivot exists for.
    for (const zone of PAIN_ZONES) {
      const strength = LOCAL_ROUTINES.filter((r) => r.targetZones.includes(zone))
        .flatMap((r) => r.steps)
        .filter((s) => byKey.get(s.exerciseKey)?.type === 'strength')
      expect(new Set(strength.map((s) => s.exerciseKey)).size, `zone "${zone}"`).toBeGreaterThan(0)
    }
  })

  it('can fill a whole session out of discreet movements alone', () => {
    // Open space is the main context. If the discreet pool for a painful zone
    // is thin, the plan silently serves the same three movements every day.
    for (const zone of PAIN_ZONES) {
      const discreet = LOCAL_ROUTINES.filter((r) => r.targetZones.includes(zone))
        .flatMap((r) => r.steps)
        .filter((s) => byKey.get(s.exerciseKey)?.discreet === true)
      expect(new Set(discreet.map((s) => s.exerciseKey)).size, `zone "${zone}"`).toBeGreaterThanOrEqual(4)
    }
  })

  it('offers a short and a long pain_relief routine for every painful zone', () => {
    for (const zone of PAIN_ZONES) {
      const relief = LOCAL_ROUTINES.filter(
        (r) => r.goal === 'pain_relief' && r.targetZones.includes(zone),
      )
      expect(relief.some((r) => r.durationS <= 90), `zone "${zone}" has no short one`).toBe(true)
      expect(
        relief.some((r) => r.durationS >= 240 && r.durationS <= 360),
        `zone "${zone}" has no 4-6 min one`,
      ).toBe(true)
    }
  })

  it('closes every strength movement on an article, an easier way and a stop sign', () => {
    // Loading a body part that already hurts is the one place where "rien de
    // spécifique" is not an acceptable answer.
    for (const ex of LOCAL_EXERCISES.filter((e) => e.type === 'strength')) {
      expect(ex.articles.length, `${ex.key}`).toBeGreaterThan(0)
      expect(ex.easier.trim().length, `${ex.key}`).toBeGreaterThan(0)
      expect(ex.avoid.toLowerCase(), `${ex.key} has no real stop sign`).not.toContain(
        'rien de spécifique',
      )
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
