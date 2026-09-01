import type { AccentKey } from '@/lib/types'
import { FigureBadge } from './FigureBadge'

/**
 * The hero card's visual signature (§10.4): a 5x5 grid of faint circles whose
 * seven central positions carry figure pastilles. Purely decorative.
 */

/** Indices in the 5x5 grid (row-major) that hold a pastille — a flower shape. */
const PETALS = [7, 11, 12, 13, 17, 6, 18] as const

const PALETTE: AccentKey[] = ['lime', 'peach', 'sky', 'blush', 'sage', 'sun', 'slate']

const FIGURES = [
  'marche',
  'extension-debout',
  'fente',
  'chat-vache',
  'menton-rentre',
  'cercle-bras',
  'respiration',
]

export function FlowerGrid({
  badge = 44,
  className,
}: {
  /** Diameter of the pastilles; the faint circles are sized from it. */
  badge?: number
  className?: string
}) {
  const cells = Array.from({ length: 25 }, (_, i) => i)

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none grid select-none grid-cols-5 justify-items-center gap-2 ${className ?? ''}`}
    >
      {cells.map((i) => {
        const petal = PETALS.indexOf(i as (typeof PETALS)[number])
        if (petal === -1) {
          return (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: badge,
                height: badge,
                background: 'rgba(255,255,255,.04)',
              }}
            />
          )
        }
        return (
          <FigureBadge
            key={i}
            figureKey={FIGURES[petal] ?? 'marche'}
            tone={PALETTE[petal] ?? 'lime'}
            size={badge}
          />
        )
      })}
    </div>
  )
}
