/**
 * Progress ring (§10.4). Animated through stroke-dashoffset only — one
 * property, cheap, and it degrades to a static ring under reduced motion.
 */
export function TimerRing({
  progress,
  size = 220,
  stroke = 6,
  color = 'var(--accent)',
  trackOpacity = 0.12,
  children,
  className,
}: {
  /** 0 -> empty, 1 -> full. */
  progress: number
  size?: number
  stroke?: number
  color?: string
  trackOpacity?: number
  children?: React.ReactNode
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, progress))

  return (
    <div
      className={`relative inline-grid place-items-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity={trackOpacity}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 320ms linear' }}
        />
      </svg>
      <div className="relative grid place-items-center text-center">{children}</div>
    </div>
  )
}
