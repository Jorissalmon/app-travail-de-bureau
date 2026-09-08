import { useMemo } from 'react'
import { PAIN_ZONE_LABEL } from '@/content'
import { heatmap } from '@/features/plan/painStats'
import type { PainEntry, Zone } from '@/lib/types'

/**
 * The pain journal, drawn.
 *
 * One row per zone the person has actually rated — never a row for a zone
 * nobody mentioned, which would read as a body part the app has decided is a
 * problem. One cell per day, oldest on the left.
 *
 * A day with no answer is an outline, not a colour. This is the whole honesty
 * of the picture: the app cannot know that a day nobody answered was a good
 * day, and a grid that filled its gaps with green would be inventing exactly
 * the kind of number the doctrine forbids.
 *
 * The scale runs from the accent (low) to the danger colour (high) through a
 * single mix, so it reads as one dimension rather than as a traffic light —
 * there is no threshold at which an answer becomes a bad answer.
 */
export function PainHeatmap({
  entries,
  zones,
  today,
  days,
}: {
  entries: PainEntry[]
  zones: Zone[]
  today: string
  days: number
}) {
  const rows = useMemo(() => heatmap(entries, zones, today, days), [entries, zones, today, days])
  if (rows.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.zone} className="flex items-center gap-3">
          <span className="t-meta w-[92px] shrink-0 truncate">
            {PAIN_ZONE_LABEL[row.zone] ?? row.zone}
          </span>
          <div className="flex min-w-0 flex-1 gap-[3px]">
            {row.cells.map((cell) => (
              <span
                key={cell.localDate}
                title={
                  cell.score === null
                    ? `${cell.localDate} — pas de réponse`
                    : `${cell.localDate} — ${cell.score}/10`
                }
                aria-label={
                  cell.score === null
                    ? `${cell.localDate}, pas de réponse`
                    : `${cell.localDate}, ${cell.score} sur 10`
                }
                className="h-5 min-w-0 flex-1 rounded-[3px]"
                style={
                  cell.score === null
                    ? { border: '1px solid var(--border)' }
                    : {
                        background: `color-mix(in srgb, var(--danger) ${
                          10 + cell.score * 9
                        }%, var(--accent))`,
                      }
                }
              />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-3">
        <span className="t-meta w-[92px] shrink-0" />
        <div className="flex min-w-0 flex-1 justify-between">
          <span className="t-meta">il y a {days} jours</span>
          <span className="t-meta">aujourd’hui</span>
        </div>
      </div>
    </div>
  )
}
