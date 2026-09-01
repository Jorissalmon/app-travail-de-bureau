import type { ReactNode } from 'react'

/**
 * Surface primitive. Hierarchy comes from surface value, never from a shadow
 * (§10.3): on a pure black background a drop shadow is invisible.
 */
export function Card({
  children,
  radius = 'routine',
  bordered = false,
  className,
  style,
}: {
  children: ReactNode
  radius?: 'hero' | 'routine' | 'zone' | 'button'
  /** 1px rule — small cards only. */
  bordered?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        borderRadius: `var(--r-${radius})`,
        border: bordered ? '1px solid var(--border)' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
