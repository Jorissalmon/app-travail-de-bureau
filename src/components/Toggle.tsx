export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 46,
        height: 28,
        background: checked ? 'var(--accent)' : 'var(--surface-3)',
      }}
    >
      <span
        className="absolute top-1 rounded-full transition-all"
        style={{
          width: 20,
          height: 20,
          background: checked ? 'var(--accent-ink)' : 'var(--text)',
          left: checked ? 22 : 4,
        }}
      />
    </button>
  )
}
