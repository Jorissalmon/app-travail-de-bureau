import { addDays, daysBetween } from '@/lib/date'
import type { PainEntry, Zone } from '@/lib/types'

/**
 * What the pain journal says, as pure functions. Shared by the plan composer,
 * the home screen and the tests, so the number on the card and the number the
 * plan reasons about can never disagree.
 *
 * Nothing here estimates, smooths or projects. Every value returned is either
 * an answer the user gave or an arithmetic mean of answers they gave, and a
 * zone with no answers returns null rather than zero — "pas de donnée" and
 * "zéro sur dix" are not the same statement, and only one of them is true.
 */

/** The most recent answer for a zone, or null if it was never rated. */
export function latestScore(entries: PainEntry[], zone: Zone): number | null {
  let best: PainEntry | null = null
  for (const e of entries) {
    if (e.zone !== zone) continue
    if (best === null || e.at > best.at) best = e
  }
  return best?.score ?? null
}

/** One value per day for a zone: the mean of that day's answers. */
export function dailyMeans(entries: PainEntry[], zone: Zone): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>()
  for (const e of entries) {
    if (e.zone !== zone) continue
    const row = sums.get(e.localDate) ?? { total: 0, n: 0 }
    row.total += e.score
    row.n++
    sums.set(e.localDate, row)
  }
  return new Map([...sums].map(([d, r]) => [d, r.total / r.n]))
}

export interface Delta {
  zone: Zone
  /** The first day's mean, and the date it was given. */
  from: number
  fromDate: string
  /** The most recent day's mean, and its date. */
  to: number
  toDate: string
  /** Whole days between the two, which is what the sentence says. */
  days: number
  /** to - from. Negative means the reported pain came down. */
  change: number
}

/**
 * The « Nuque : 6 → 3 en 11 jours » line, or null.
 *
 * Null unless there are answers on at least two distinct days inside the
 * window: one answer is not a trend, and a card that says "6 → 6 en 0 jour" is
 * noise. The two ends are day means, not single answers, so one bad afternoon
 * does not become the headline.
 */
export function delta(
  entries: PainEntry[],
  zone: Zone,
  today: string,
  windowDays: number,
): Delta | null {
  const means = dailyMeans(entries, zone)
  const days = [...means.keys()]
    .filter((d) => {
      const diff = daysBetween(d, today)
      return diff >= 0 && diff < windowDays
    })
    .sort()
  if (days.length < 2) return null
  const fromDate = days[0] as string
  const toDate = days[days.length - 1] as string
  const from = means.get(fromDate) as number
  const to = means.get(toDate) as number
  return {
    zone,
    from,
    fromDate,
    to,
    toDate,
    days: daysBetween(fromDate, toDate),
    change: to - from,
  }
}

/**
 * The direction the plan doses on: the mean of the newest third of the window
 * against the mean of the oldest third, in points.
 *
 * Thirds rather than first-and-last answer, because a single answer is noisy
 * and the plan changes what it serves on the strength of this. Null until both
 * ends actually hold something — the plan then stays on mobility, which is the
 * conservative side.
 */
export function trend(
  entries: PainEntry[],
  zone: Zone,
  today: string,
  windowDays: number,
): number | null {
  const means = dailyMeans(entries, zone)
  const days = [...means.keys()]
    .filter((d) => {
      const diff = daysBetween(d, today)
      return diff >= 0 && diff < windowDays
    })
    .sort()
  if (days.length < 4) return null
  const cut = Math.max(1, Math.floor(days.length / 3))
  const oldest = days.slice(0, cut)
  const newest = days.slice(-cut)
  const mean = (list: string[]) =>
    list.reduce((n, d) => n + (means.get(d) as number), 0) / list.length
  return mean(newest) - mean(oldest)
}

export interface HeatmapCell {
  localDate: string
  /** Null where nothing was answered that day: an empty cell, not a zero. */
  score: number | null
}

export interface HeatmapRow {
  zone: Zone
  cells: HeatmapCell[]
}

/**
 * One row per zone, one cell per day, oldest day first. Days with no answer
 * come back null so the grid can draw a hole rather than a green square that
 * claims a pain-free day nobody reported.
 */
export function heatmap(
  entries: PainEntry[],
  zones: Zone[],
  today: string,
  windowDays: number,
): HeatmapRow[] {
  return zones.map((zone) => {
    const means = dailyMeans(entries, zone)
    const cells: HeatmapCell[] = []
    for (let i = windowDays - 1; i >= 0; i--) {
      const localDate = addDays(today, -i)
      const value = means.get(localDate)
      cells.push({ localDate, score: value === undefined ? null : Math.round(value * 10) / 10 })
    }
    return { zone, cells }
  })
}

/** How many distinct days carry at least one answer, inside a window. */
export function answeredDays(entries: PainEntry[], today: string, windowDays: number): number {
  const days = new Set<string>()
  for (const e of entries) {
    const diff = daysBetween(e.localDate, today)
    if (diff >= 0 && diff < windowDays) days.add(e.localDate)
  }
  return days.size
}
