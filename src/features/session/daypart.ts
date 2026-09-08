import { minutesOfDayFrom } from '@/lib/date'

/**
 * What the app suggests right now (§11.1). The day is not uniform: the hips
 * pay for the morning, the eyes and the slump belong to mid-afternoon, the
 * calves to the end of it. Rather than offering the same twelve routines at
 * every hour, the home screen leads with one, and says why.
 *
 * Pure: every input is an argument, so the whole thing is testable and the
 * clock is read in exactly one place (§5).
 */

export type DayPart = 'matin' | 'matinee' | 'midi' | 'apres-midi' | 'fin-journee' | 'soir' | 'nuit'

export interface DayContext {
  now: Date
  /** A work session is running. */
  sessionActive: boolean
  /** Stands recorded today, used to vary the suggestion as the day goes on. */
  standsToday: number
  /**
   * Slugs the content store actually holds. The database is what the app reads
   * when online, and it can lag behind the code that names these routines — a
   * suggestion pointing at a slug that is not there must degrade to one that
   * is, never to an empty card.
   */
  available: string[]
}

export interface DayAdvice {
  part: DayPart
  /** The headline on the home card. */
  headline: string
  /** One line on why this, now. */
  why: string
  /** The routine the card opens. */
  routineSlug: string
}

interface Band {
  part: DayPart
  /** Local minute of day this band starts at. */
  from: number
  headline: string
  why: string
  /** Notification body. One short line — it is read on a lock screen. */
  nudge: string
  /** Cycled through as stands accumulate, so the card is not the same all day. */
  candidates: string[]
}

/** Ordered by start time. The last band wraps past midnight. */
const BANDS: Band[] = [
  {
    part: 'nuit',
    from: 0,
    headline: 'Il est tard.',
    why: 'Rien à rattraper à cette heure-ci. Deux minutes pour redescendre, et au lit.',
    nudge: 'Il est tard. Deux minutes pour redescendre, et au lit.',
    candidates: ['respiration'],
  },
  {
    part: 'matin',
    from: 5 * 60,
    headline: 'Réveille-toi en douceur.',
    why: 'Le corps sort de huit heures immobiles. Dérouille avant de t’asseoir pour huit de plus.',
    nudge: 'Dérouille-toi avant de t’asseoir pour la journée.',
    candidates: ['reveil', 'nuque'],
  },
  {
    part: 'matinee',
    from: 9 * 60,
    headline: 'La matinée est lancée.',
    why: 'C’est maintenant que la posture se prend, pas à 17 h quand la nuque tire déjà.',
    nudge: 'La posture se prend maintenant, pas à 17 h.',
    candidates: ['debout', 'nuque', 'express'],
  },
  {
    part: 'midi',
    from: 11 * 60 + 30,
    headline: 'Coupe vraiment.',
    why: 'Une matinée assise raccourcit les fléchisseurs de hanche. C’est le moment de les rouvrir.',
    nudge: 'Coupe vraiment. Ouvre les hanches.',
    candidates: ['hanches', 'debout', 'bureau-complet'],
  },
  {
    part: 'apres-midi',
    from: 13 * 60 + 30,
    headline: 'Le creux de l’après-midi.',
    why: 'Deux minutes valent autant que douze sur la douleur nuque et épaules. Prends les deux.',
    nudge: 'Le creux de l’après-midi. Deux minutes suffisent.',
    candidates: ['express', 'dos', 'poignets', 'yeux'],
  },
  {
    part: 'fin-journee',
    from: 16 * 60 + 30,
    headline: 'Fin de journée.',
    why: 'Les jambes ont stagné depuis ce matin, et le bas du dos a tenu la position tout seul.',
    nudge: 'Les jambes ont stagné depuis ce matin.',
    candidates: ['chevilles', 'lombaires', 'bureau-complet'],
  },
  {
    part: 'soir',
    from: 18 * 60 + 30,
    headline: 'La journée est finie.',
    why: 'Rien d’intense. De quoi défaire ce que la chaise a fait, et rien de plus.',
    nudge: 'Défais ce que la chaise a fait. Rien de plus.',
    candidates: ['respiration', 'lombaires'],
  },
]

export function bandFor(now: Date): Band {
  const minute = minutesOfDayFrom(now)
  let found = BANDS[0]!
  for (const band of BANDS) {
    if (minute >= band.from) found = band
  }
  return found
}

/**
 * The notification line for a reminder that fires at `at`. Read on a lock
 * screen, so it is one short sentence, and it is chosen from the time the
 * reminder is scheduled for rather than the time it was planned.
 */
export function nudgeFor(at: Date): string {
  return bandFor(at).nudge
}

export function adviceFor(ctx: DayContext): DayAdvice | null {
  const band = bandFor(ctx.now)
  const offered = band.candidates.filter((slug) => ctx.available.includes(slug))
  // Nothing from this band is available: rather than an empty card, fall back
  // to whatever the content store does have.
  const pool = offered.length > 0 ? offered : ctx.available
  if (pool.length === 0) return null

  const index = Math.max(0, ctx.standsToday) % pool.length
  return {
    part: band.part,
    headline: band.headline,
    why: ctx.sessionActive ? band.why : 'Ta session n’est pas lancée : aucun rappel ne partira.',
    routineSlug: pool[index]!,
  }
}
