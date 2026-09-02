import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { FigureBadge } from './FigureBadge'
import { useContentStore } from '@/stores/content'
import type { DayAdvice } from '@/features/session/daypart'
import { durationLabel } from '@/lib/format'

/**
 * The one thing the app suggests right now (§11.1). Leads the home screen so
 * the answer to "what should I do" is on screen before any browsing.
 */
export function DayCard({ advice }: { advice: DayAdvice }) {
  const routine = useContentStore((s) => s.routineBySlug(advice.routineSlug))
  if (!routine) return null

  return (
    <Link
      to={`/library/${routine.slug}`}
      className="mt-4 block overflow-hidden transition-colors active:opacity-90"
      style={{ background: 'var(--surface)', borderRadius: 'var(--r-routine)' }}
    >
      <div className="flex items-center gap-4 p-4">
        <FigureBadge
          figureKey={routine.steps[0]?.figureKey ?? 'marche'}
          tone={routine.accent}
          size={64}
          animated
        />
        <div className="min-w-0 flex-1">
          <p className="t-card-eyebrow">{advice.headline}</p>
          <h3 className="mt-1 text-[20px] leading-tight font-800" style={{ fontWeight: 800 }}>
            {routine.title}
          </h3>
          <p className="t-meta mt-1">{durationLabel(routine.durationS)}</p>
        </div>
        <ArrowRight size={20} color="var(--text-2)" aria-hidden="true" />
      </div>
      <p className="t-meta px-4 pb-4">{advice.why}</p>
    </Link>
  )
}
