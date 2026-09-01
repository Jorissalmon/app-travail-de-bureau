import { Suspense, lazy, useMemo } from 'react'
import type { AccentKey } from '@/lib/types'
import { isFigureKey } from './figures/figureKeys'

const Figures = lazy(async () => {
  const mod = await import('./figures/figures')
  return {
    default: ({ figureKey }: { figureKey: string }) => {
      if (!isFigureKey(figureKey)) return null
      const Draw = mod.default[figureKey]
      return <Draw />
    },
  }
})

/**
 * Round pastel pastille with a flat figure in it (§10.4).
 * The figure tone is picked automatically for contrast against the pastille,
 * so callers only pass a colour key.
 */

/** Pastilles that are light enough to need a dark figure on top. */
const LIGHT_TONES: ReadonlySet<AccentKey> = new Set([
  'peach',
  'sky',
  'lime',
  'blush',
  'sun',
  'sage',
])

export interface FigureBadgeProps {
  figureKey: string
  tone: AccentKey
  /** Rendered diameter in px. The spec's three sizes are 32 / 56 / 88. */
  size?: number
  className?: string
}

export function FigureBadge({ figureKey, tone, size = 56, className }: FigureBadgeProps) {
  const pastille = `var(--${tone})`
  const ink = LIGHT_TONES.has(tone) ? 'var(--figure-dark)' : 'var(--figure-light)'
  const style = useMemo(
    () =>
      ({
        width: size,
        height: size,
        background: pastille,
        color: ink,
        '--pastille': pastille,
      }) as React.CSSProperties,
    [size, pastille, ink],
  )

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className ?? ''}`}
      style={style}
    >
      {/* Below ~28px the figure is illegible; the plain pastille reads better. */}
      {size >= 28 && (
        <Suspense fallback={null}>
          <svg viewBox="0 0 100 100" width="72%" height="72%" role="presentation">
            <Figures figureKey={figureKey} />
          </svg>
        </Suspense>
      )}
    </span>
  )
}
