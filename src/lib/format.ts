/** Display formatting. French, tutoiement, no jargon (§C6). */

/** 125 -> "2:05". Used by the player countdown and the next-reminder countdown. */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/** 7830 s -> "2 h 10". Elapsed session time, spelled out. */
export function elapsedLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m} MIN`
  return `${h} H ${String(m).padStart(2, '0')}`
}

/** 180 -> "3 minutes", 60 -> "1 minute", 90 -> "1 min 30". */
export function durationLabel(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (s === 0) return m <= 1 ? `${m} minute` : `${m} minutes`
  if (m === 0) return `${s} s`
  return `${m} min ${s}`
}

/** Card eyebrow: "5 MINUTES". */
export function durationEyebrow(totalSeconds: number): string {
  return durationLabel(totalSeconds).toUpperCase()
}

/** 42 -> "42 min", 95 -> "1 h 35". Minutes actually moved, not an estimate. */
export function minutesLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

export function plural(n: number, one: string, many: string): string {
  return n <= 1 ? one : many
}

/** "3 levers sur 6 rappels" — factual, no praise, no blame (§13.4). */
export function standsLine(stands: number, reminders: number): string {
  if (stands === 0 && reminders === 0) return 'Aucun lever aujourd’hui'
  if (stands === 0) return 'Aucun lever aujourd’hui'
  return `${stands} ${plural(stands, 'lever', 'levers')} sur ${reminders} ${plural(
    reminders,
    'rappel',
    'rappels',
  )}`
}

export function percent(v: number | null): string {
  if (v === null) return '—'
  return `${Math.round(v * 100)} %`
}
