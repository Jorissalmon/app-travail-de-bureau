import type { Completion, JournalDay, ReminderEvent } from '@/lib/types'
import { withinDays } from './stats'

export type { JournalDay, JournalEntry, JournalEntryKind } from '@/lib/types'

/**
 * The activity journal: what actually happened, day by day, in order.
 *
 * The tracking screen counted things — levers, minutes, a rate — and counting
 * answers « combien » without ever answering « quoi ». A day of five levers and
 * a day of five levers where two were reported and one was missed read the same
 * number and are not the same day.
 *
 * Pure, and shared by the server and the device, exactly like `./stats`: the
 * numbers must not depend on which of the two answered first.
 */

export interface WorkSpan {
  startedAt: string
  endedAt: string | null
  localDate: string
}

export interface JournalInput {
  sessions: WorkSpan[]
  events: ReminderEvent[]
  completions: Completion[]
  /** The device's own today, so days are cut where the user lives. */
  today: string
  /** How many days back to keep. */
  span: number
  now: string
}

function spanSeconds(s: WorkSpan, now: string): number {
  const from = new Date(s.startedAt).getTime()
  const to = new Date(s.endedAt ?? now).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, Math.round((to - from) / 1000))
}

/** Newest day first, which is the order the screen scrolls in. */
export function buildJournal({
  sessions,
  events,
  completions,
  today,
  span,
  now,
}: JournalInput): JournalDay[] {
  const days = new Map<string, JournalDay>()
  const day = (localDate: string): JournalDay => {
    let d = days.get(localDate)
    if (!d) {
      d = {
        localDate,
        workedS: 0,
        movedS: 0,
        focusS: 0,
        stands: 0,
        reminders: 0,
        open: false,
        entries: [],
      }
      days.set(localDate, d)
    }
    return d
  }

  const keep = (localDate: string) => withinDays(localDate, today, span)

  for (const s of sessions) {
    if (!keep(s.localDate)) continue
    const d = day(s.localDate)
    d.workedS += spanSeconds(s, now)
    d.entries.push({ at: s.startedAt, kind: 'start' })
    if (s.endedAt) d.entries.push({ at: s.endedAt, kind: 'end' })
    else d.open = true
  }

  for (const c of completions) {
    if (!keep(c.localDate)) continue
    const d = day(c.localDate)
    d.movedS += c.durationS
    d.entries.push({
      at: c.completedAt,
      kind: 'moved',
      routineSlug: c.routineSlug,
      durationS: c.durationS,
    })
  }

  for (const e of events) {
    if (!keep(e.localDate)) continue
    const d = day(e.localDate)
    d.reminders++
    if (e.action === 'done') {
      d.stands++
      // A « Fait » from the notification, with no routine behind it, is still a
      // lever and deserves its line. One followed by a routine would double the
      // day, so it is only written when nothing was completed near it.
      const near = completions.some(
        (c) => Math.abs(new Date(c.completedAt).getTime() - new Date(e.actedAt ?? e.firedAt).getTime()) < 15 * 60_000,
      )
      if (!near) d.entries.push({ at: e.actedAt ?? e.firedAt, kind: 'stood' })
      continue
    }
    if (e.action === 'snoozed') {
      d.entries.push({ at: e.actedAt ?? e.firedAt, kind: 'snoozed' })
      continue
    }
    d.entries.push({ at: e.firedAt, kind: 'missed' })
  }

  for (const d of days.values()) {
    d.focusS = Math.max(0, d.workedS - d.movedS)
    d.entries.sort((a, b) => a.at.localeCompare(b.at))
  }

  return [...days.values()].sort((a, b) => b.localDate.localeCompare(a.localDate))
}
