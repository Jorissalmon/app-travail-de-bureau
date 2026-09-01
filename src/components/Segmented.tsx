/** A compact single-choice segmented control, used for the interval picker. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  format,
  recommended,
  ariaLabel,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  format?: (v: T) => string
  recommended?: T
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className="relative rounded-[12px] py-2.5 text-[15px] font-700"
            style={{
              background: active ? 'var(--accent)' : 'var(--surface-2)',
              color: active ? 'var(--accent-ink)' : 'var(--text)',
              fontWeight: 700,
            }}
          >
            {format ? format(opt) : String(opt)}
            {recommended === opt && !active && (
              <span
                aria-hidden="true"
                className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
