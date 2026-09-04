import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Bottom sheet (§10.4): 28px corners, a grab handle, dismissed by dragging
 * down or tapping the scrim. No animation library — one transform and one
 * opacity, both dropped under prefers-reduced-motion.
 *
 * Two things it now does that it did not:
 *
 * It has a height. A long list (the exercise picker holds forty-two) made the
 * panel taller than the screen, and since it sits at the bottom of a fixed
 * container the overflow ran off the top with nothing to scroll: the last
 * entries were simply unreachable.
 *
 * And the drag lives on the handle, not on the whole panel. With a scrollable
 * body the two gestures were the same gesture: swiping the list down dragged
 * the sheet away instead of scrolling it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setDragY(0)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Focus the panel so screen readers land inside the sheet, not behind it.
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="presentation">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
        style={{ transition: 'opacity var(--dur) var(--ease)' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex w-full flex-col outline-none"
        style={{
          background: 'var(--surface)',
          borderTopLeftRadius: 'var(--r-sheet)',
          borderTopRightRadius: 'var(--r-sheet)',
          maxHeight: '86vh',
          transform: `translateY(${dragY}px)`,
          transition: startY.current === null ? 'transform 220ms var(--ease)' : 'none',
        }}
      >
        <div
          className="shrink-0"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            startY.current = e.clientY
          }}
          onPointerMove={(e) => {
            if (startY.current === null) return
            setDragY(Math.max(0, e.clientY - startY.current))
          }}
          onPointerUp={() => {
            if (dragY > 110) onClose()
            else setDragY(0)
            startY.current = null
          }}
          onPointerCancel={() => {
            setDragY(0)
            startY.current = null
          }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <span
              aria-hidden="true"
              className="block h-1 w-10 rounded-full"
              style={{ background: 'var(--surface-3)' }}
            />
          </div>
          <div className="gutter pt-2">
            <h2 className="t-screen mb-3">{title}</h2>
          </div>
        </div>

        <div
          className="no-scrollbar gutter min-h-0 flex-1 overflow-y-auto"
          style={{
            overscrollBehavior: 'contain',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
