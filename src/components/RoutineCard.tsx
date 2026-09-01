import { Link } from 'react-router-dom'
import type { Routine } from '@/lib/types'
import { durationEyebrow } from '@/lib/format'
import { FigureBadge } from './FigureBadge'

/**
 * Duration eyebrow + title + a reduced FlowerGrid built from the routine's own
 * steps, so two routines never look alike (§10.4).
 */
export function RoutineCard({ routine }: { routine: Routine }) {
  const keys = routine.steps.slice(0, 6).map((s) => s.figureKey)

  return (
    <Link
      to={`/library/${routine.slug}`}
      aria-label={`${routine.title}, ${durationEyebrow(routine.durationS).toLowerCase()}`}
      className="block overflow-hidden transition-colors active:opacity-90"
      style={{ background: 'var(--surface)', borderRadius: 'var(--r-routine)' }}
    >
      <div className="px-4 pt-4">
        <p className="t-card-eyebrow">{durationEyebrow(routine.durationS)}</p>
        <h3 className="mt-1 text-[22px] leading-tight font-800" style={{ fontWeight: 800 }}>
          {routine.title}
        </h3>
        <p className="t-meta mt-1.5 line-clamp-2">{routine.summary}</p>
      </div>

      <div
        aria-hidden="true"
        className="mt-3 flex items-end gap-1.5 overflow-hidden px-4 pb-4"
        style={{ height: 52 }}
      >
        {keys.map((k, i) => (
          <FigureBadge
            key={`${k}-${i}`}
            figureKey={k}
            tone={i === 0 ? routine.accent : 'slate'}
            size={i === 0 ? 44 : 34}
            className={i === 0 ? '' : 'opacity-45'}
          />
        ))}
      </div>
    </Link>
  )
}
