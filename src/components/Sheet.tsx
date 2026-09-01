import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Bottom sheet (§10.4): 28px corners, a grab handle, dismissed by dragging
 * down or tapping the scrim. No animation library — one transform and one
 * opacity, both dropped under prefers-reduced-motion.
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
        className="relative w-full outline-none"
        style={{
          background: 'var(--surface)',
          borderTopLeftRadius: 'var(--r-sheet)',
          borderTopRightRadius: 'var(--r-sheet)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          transform: `translateY(${dragY}px)`,
          transition: startY.current === null ? 'transform 220ms var(--ease)' : 'none',
        }}
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
          {children}
        </div>
      </div>
    </div>
  )
}
