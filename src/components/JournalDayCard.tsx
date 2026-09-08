import { Check, Clock, MoveRight, Play, Square, X } from 'lucide-react'
import type { JournalDay, JournalEntry, JournalEntryKind } from '@/lib/types'
import { clockTime, journalDayLabel } from '@/lib/date'
import { hoursLabel, plural } from '@/lib/format'

/**
 * One day of the activity journal.
 *
 * The screen above it counts; this says what happened. The distinction matters
 * for the same reason the app never invents a health figure: « cinq levers » is
 * a number, « démarrée à 9 h 04, trois pauses bougées, un rappel manqué à
 * 14 h 30, terminée à 18 h 12 » is the day.
 */

const ICON: Record<JournalEntryKind, typeof Play> = {
  start: Play,
  end: Square,
  moved: MoveRight,
  stood: Check,
  snoozed: Clock,
  missed: X,
}

const LABEL: Record<JournalEntryKind, string> = {
  start: 'Journée démarrée',
  end: 'Journée terminée',
  moved: 'Pause bougée',
  stood: 'Levé, sans routine',
  snoozed: 'Rappel reporté',
  missed: 'Rappel manqué',
}

/** Missed reads as a fault; nothing else does. Only that one is tinted. */
function tone(kind: JournalEntryKind): string {
  if (kind === 'missed') return 'var(--text-3)'
  if (kind === 'start' || kind === 'end') return 'var(--text-2)'
  return 'var(--accent)'
}

export function JournalDayCard({
  day,
  today,
  routineTitle,
}: {
  day: JournalDay
  today: string
  routineTitle: (slug: string) => string | undefined
}) {
  return (
    <section className="rounded-[20px] p-5" style={{ background: 'var(--surface)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[16px]" style={{ fontWeight: 700 }}>
          {journalDayLabel(day.localDate, today)}
        </p>
        <p className="num text-[15px]" style={{ color: day.open ? 'var(--accent)' : 'var(--text-2)' }}>
          {hoursLabel(day.workedS)}
          {day.open && ' · en cours'}
        </p>
      </div>

      <p className="t-meta mt-1">
        {hoursLabel(day.focusS)} de focus · {hoursLabel(day.movedS)} bougées ·{' '}
        {day.stands} {plural(day.stands, 'pause prise', 'pauses prises')} sur {day.reminders}{' '}
        {plural(day.reminders, 'rappel', 'rappels')}
      </p>

      {day.entries.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2.5">
          {day.entries.map((e, i) => (
            <Line key={`${e.at}-${i}`} entry={e} routineTitle={routineTitle} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Line({
  entry,
  routineTitle,
}: {
  entry: JournalEntry
  routineTitle: (slug: string) => string | undefined
}) {
  const Icon = ICON[entry.kind]
  const colour = tone(entry.kind)
  const title = entry.routineSlug ? routineTitle(entry.routineSlug) : undefined
  const detail =
    entry.kind === 'moved'
      ? [title, entry.durationS ? hoursLabel(entry.durationS) : null].filter(Boolean).join(' · ')
      : null

  return (
    <li className="flex items-center gap-3">
      <span
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: 26, height: 26, background: 'var(--surface-2)' }}
      >
        <Icon size={13} color={colour} />
      </span>
      <span className="min-w-0 flex-1 text-[15px]">
        {LABEL[entry.kind]}
        {detail && (
          <span style={{ color: 'var(--text-2)' }}> — {detail}</span>
        )}
      </span>
      <span className="num shrink-0 text-[13px]" style={{ color: 'var(--text-3)' }}>
        {clockTime(entry.at)}
      </span>
    </li>
  )
}
