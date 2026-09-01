import { Link } from 'react-router-dom'
import type { AccentKey } from '@/lib/types'
import { FigureBadge } from './FigureBadge'

export function ZoneCard({
  label,
  to,
  figureKey,
  tone,
}: {
  label: string
  to: string
  figureKey: string
  tone: AccentKey
}) {
  return (
    <Link
      to={to}
      aria-label={`Routines pour la zone ${label}`}
      className="flex items-center gap-3 px-3 py-3 transition-colors active:bg-[var(--surface-2)]"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-zone)',
        minHeight: 64,
      }}
    >
      <FigureBadge figureKey={figureKey} tone={tone} size={36} />
      <span className="truncate text-[15px] font-700" style={{ fontWeight: 700 }}>
        {label}
      </span>
    </Link>
  )
}
