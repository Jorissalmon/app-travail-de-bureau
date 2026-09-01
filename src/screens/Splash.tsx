/** Shown while auth is resolving on boot. Just the wordmark, no spinner noise. */
export function Splash() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center" style={{ background: 'var(--bg)' }}>
      <span className="t-day" style={{ color: 'var(--text)' }}>
        Relève
      </span>
    </div>
  )
}
