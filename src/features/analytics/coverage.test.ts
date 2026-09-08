import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Every declared event must have an emitter somewhere in the app.
 *
 * `reminder_acted`, `streak_freeze_used` and `article_opened` sat in the union
 * for days with no call site: a schema that looks complete, four validation
 * metrics that could never be computed, and nothing anywhere to say so. A type
 * cannot catch this — an unused member of a union is perfectly valid — so it
 * takes a test that reads the source.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const CATALOGUE = 'src/features/analytics/events.ts'

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sources(full, out)
    else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) {
      out.push(full)
    }
  }
  return out
}

const names = (text: string) => new Set(text.match(/name: '[a-z_]+'/g) ?? [])

describe('analytics catalogue', () => {
  const declared = names(readFileSync(resolve(root, CATALOGUE), 'utf8'))

  it('declares the events the validation protocol needs', () => {
    // docs/VALIDATION-PIVOT.md §2-3: the cohort, the pain series and both ends
    // of the completion rate.
    for (const needed of [
      "name: 'onboarding_completed'",
      "name: 'pain_rated'",
      "name: 'session_started'",
      "name: 'session_completed'",
    ]) {
      expect(declared).toContain(needed)
    }
  })

  it('has a real emitter for every declared event', () => {
    const emitted = new Set<string>()
    for (const file of sources(resolve(root, 'src'))) {
      if (file.endsWith('analytics/events.ts')) continue
      for (const n of names(readFileSync(file, 'utf8'))) emitted.add(n)
    }
    const dead = [...declared].filter((n) => !emitted.has(n)).sort()
    expect(dead, `déclarés mais jamais émis : ${dead.join(', ')}`).toEqual([])
  })
})
