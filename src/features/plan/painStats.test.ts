import { describe, expect, it } from 'vitest'
import { answeredDays, dailyMeans, delta, heatmap, latestScore, trend } from './painStats'
import type { PainEntry, Zone } from '@/lib/types'

/**
 * The pain journal is the only outcome number the app is allowed to show, so
 * these tests are mostly about what it refuses to say: no trend from a single
 * answer, no zero where nobody answered, no delta invented across a gap.
 */

const TODAY = '2026-03-16'

function e(zone: Zone, score: number, localDate: string, hour = 17): PainEntry {
  return {
    clientId: `${zone}-${localDate}-${score}`,
    at: `${localDate}T${String(hour).padStart(2, '0')}:00:00.000Z`,
    localDate,
    zone,
    score,
    source: 'post-session',
  }
}

describe('latestScore', () => {
  it('is null for a zone nobody rated', () => {
    expect(latestScore([e('nuque', 5, '2026-03-15')], 'poignets')).toBeNull()
  })

  it('reads the most recent answer, not the last one in the array', () => {
    const entries = [e('nuque', 8, '2026-03-15', 18), e('nuque', 3, '2026-03-15', 9)]
    expect(latestScore(entries, 'nuque')).toBe(8)
  })
})

describe('dailyMeans', () => {
  it('averages the answers given on the same day', () => {
    const entries = [e('nuque', 6, '2026-03-15', 9), e('nuque', 2, '2026-03-15', 18)]
    expect(dailyMeans(entries, 'nuque').get('2026-03-15')).toBe(4)
  })
})

describe('delta', () => {
  it('is null on a single day of answers — one answer is not a trend', () => {
    expect(delta([e('nuque', 6, '2026-03-15')], 'nuque', TODAY, 14)).toBeNull()
  })

  it('reports the two ends and the days between them', () => {
    const entries = [e('nuque', 6, '2026-03-05'), e('nuque', 3, '2026-03-16')]
    const d = delta(entries, 'nuque', TODAY, 14)
    expect(d).not.toBeNull()
    expect(d?.from).toBe(6)
    expect(d?.to).toBe(3)
    expect(d?.days).toBe(11)
    expect(d?.change).toBe(-3)
  })

  it('ignores answers older than the window', () => {
    const entries = [e('nuque', 9, '2026-01-01'), e('nuque', 6, '2026-03-15'), e('nuque', 5, '2026-03-16')]
    expect(delta(entries, 'nuque', TODAY, 14)?.from).toBe(6)
  })
})

describe('trend', () => {
  it('is null until there is enough to compare', () => {
    const entries = [e('nuque', 6, '2026-03-14'), e('nuque', 3, '2026-03-15')]
    expect(trend(entries, 'nuque', TODAY, 14)).toBeNull()
  })

  it('is negative when the reported pain came down', () => {
    const entries = [
      e('nuque', 8, '2026-03-10'),
      e('nuque', 7, '2026-03-11'),
      e('nuque', 4, '2026-03-14'),
      e('nuque', 3, '2026-03-15'),
    ]
    const t = trend(entries, 'nuque', TODAY, 14)
    expect(t).not.toBeNull()
    expect(t as number).toBeLessThan(0)
  })

  it('is positive when it went up', () => {
    const entries = [
      e('nuque', 2, '2026-03-10'),
      e('nuque', 3, '2026-03-11'),
      e('nuque', 6, '2026-03-14'),
      e('nuque', 7, '2026-03-15'),
    ]
    expect(trend(entries, 'nuque', TODAY, 14) as number).toBeGreaterThan(0)
  })
})

describe('heatmap', () => {
  it('draws one cell per day, oldest first', () => {
    const rows = heatmap([], ['nuque'], TODAY, 7)
    expect(rows[0]?.cells).toHaveLength(7)
    expect(rows[0]?.cells[0]?.localDate).toBe('2026-03-10')
    expect(rows[0]?.cells[6]?.localDate).toBe(TODAY)
  })

  it('leaves a day with no answer empty rather than calling it a zero', () => {
    const rows = heatmap([e('nuque', 4, TODAY)], ['nuque'], TODAY, 3)
    expect(rows[0]?.cells.map((c) => c.score)).toEqual([null, null, 4])
  })
})

describe('answeredDays', () => {
  it('counts distinct days, not answers', () => {
    const entries = [e('nuque', 4, '2026-03-15', 9), e('dos', 2, '2026-03-15', 18), e('nuque', 3, TODAY)]
    expect(answeredDays(entries, TODAY, 7)).toBe(2)
  })
})
