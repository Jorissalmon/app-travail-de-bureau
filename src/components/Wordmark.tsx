/**
 * The mark: the power glyph, which is what "log off" means on every machine
 * anyone has ever used, and is the same shape as the launcher and notification
 * icons (android/app/src/main/res/drawable/ic_launcher_foreground.xml). Drawn
 * inline rather than imported, so it inherits the type colour and needs no
 * asset at any size.
 */
export function PowerGlyph({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
    >
      <path d="M6.7 7.7 A7.5 7.5 0 1 0 17.3 7.7" />
      <path d="M12 3 L12 12" />
    </svg>
  )
}

export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.3 }}>
      <PowerGlyph size={size} className="shrink-0" />
      <span
        style={{
          fontSize: size,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        Log Off
      </span>
    </span>
  )
}
