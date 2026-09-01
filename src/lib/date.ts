/** Date helpers. Everything that touches "which day is it" lives here so the
    local-date rule of the spec is applied in exactly one place. */

const DAYS = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

/**
 * "YYYY-MM-DD" in the device timezone. This is what the client sends with every
 * event; the server never recomputes it with now()::date, so a day still counts
 * correctly while travelling.
 */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse "YYYY-MM-DD" into a Date at local midnight. */
export function fromLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoWeekday(d: Date): number {
  const js = d.getDay()
  return js === 0 ? 7 : js
}

export function dayName(d: Date = new Date()): string {
  return DAYS[d.getDay()] ?? ''
}

/** "1 SEPTEMBRE" — the date eyebrow of the Today screen. */
export function dateEyebrow(d: Date = new Date()): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`.toUpperCase()
}

/** Minutes since local midnight, from "HH:MM". Returns null on empty input. */
export function minutesOfDay(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return (h ?? 0) * 60 + (m ?? 0)
}

export function minutesOfDayFrom(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Add n days to a local date string, staying on local midnights. */
export function addDays(dateStr: string, n: number): string {
  const d = fromLocalDate(dateStr)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

/** Whole days between two local date strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = fromLocalDate(b).getTime() - fromLocalDate(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** Short weekday initial used by the 7-day bar chart. */
export function weekdayInitial(dateStr: string): string {
  const name = DAYS[fromLocalDate(dateStr).getDay()] ?? ''
  return name.slice(0, 1).toUpperCase()
}
