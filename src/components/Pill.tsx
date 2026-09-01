import type { ReactNode } from 'react'

export type PillVariant = 'neutral' | 'accent' | 'solid' | 'partial' | 'weak'

const STYLES: Record<PillVariant, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--surface-2)', fg: 'var(--text-2)' },
  accent: { bg: 'var(--accent)', fg: 'var(--accent-ink)' },
  solid: { bg: 'color-mix(in srgb, var(--ev-solid) 18%, transparent)', fg: 'var(--ev-solid)' },
  partial: { bg: 'color-mix(in srgb, var(--ev-partial) 18%, transparent)', fg: 'var(--ev-partial)' },
  weak: { bg: 'color-mix(in srgb, var(--ev-weak) 18%, transparent)', fg: 'var(--ev-weak)' },
}

export function Pill({
  children,
  variant = 'neutral',
  className,
}: {
  children: ReactNode
  variant?: PillVariant
  className?: string
}) {
  const s = STYLES[variant]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] leading-none font-700 ${className ?? ''}`}
      style={{ background: s.bg, color: s.fg, fontWeight: 700 }}
    >
      {children}
    </span>
  )
}
