import { Suspense, lazy, useMemo } from 'react'
import type { AccentKey } from '@/lib/types'
import { isFigureKey } from './figures/figureKeys'
import { motionClass } from './figures/figureMotion'
import { secondFrame } from './figures/figureFrames'

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
  /** Loop the figure's own movement. For the sizes that demonstrate a gesture
      rather than label a row — the alert screen and the player. */
  animated?: boolean
  className?: string
}

export function FigureBadge({
  figureKey,
  tone,
  size = 56,
  animated = false,
  className,
}: FigureBadgeProps) {
  const pastille = `var(--${tone})`
  const ink = LIGHT_TONES.has(tone) ? 'var(--figure-dark)' : 'var(--figure-light)'
  const second = secondFrame(figureKey)
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
          {animated && second ? (
            // A movement between two positions: the two frames alternate in
            // place, which shows the whole exercise instead of half of it.
            <span className="relative inline-grid place-items-center" style={{ width: '72%', height: '72%' }}>
              <svg viewBox="0 0 100 100" className="fig-frame-a absolute inset-0 h-full w-full" role="presentation">
                <Figures figureKey={figureKey} />
              </svg>
              <svg viewBox="0 0 100 100" className="fig-frame-b absolute inset-0 h-full w-full" role="presentation">
                <Figures figureKey={second} />
              </svg>
            </span>
          ) : (
            <svg
              viewBox="0 0 100 100"
              width="72%"
              height="72%"
              role="presentation"
              className={animated ? motionClass(figureKey) : undefined}
            >
              <Figures figureKey={figureKey} />
            </svg>
          )}
        </Suspense>
      )}
    </span>
  )
}
