/**
 * The 0-10 answer, as eleven taps rather than a slider.
 *
 * A slider needs a drag, a look and a confirmation; this needs one thumb on one
 * number, which is the difference between a question that gets answered every
 * session and one that gets dismissed. Eleven targets fit across a phone at 28
 * px, which is under the 44 px tap rule — so the row is 44 px tall and the
 * targets are as wide as the width allows, which keeps the vertical dimension
 * of the gesture forgiving.
 *
 * Only the ends are labelled, and they are labelled in words the person
 * chooses between, not in a scale name: « rien » and « très fort ». No colour
 * gradient runs across the row — a red 8 tells someone their answer was a bad
 * answer, and this app does not grade answers.
 */
export function PainScale({
  value,
  onChange,
  ariaLabel,
}: {
  value: number | null
  onChange: (v: number) => void
  ariaLabel: string
}) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className="grid gap-1"
        style={{ gridTemplateColumns: 'repeat(11, minmax(0,1fr))' }}
      >
        {Array.from({ length: 11 }, (_, n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${n} sur 10`}
              onClick={() => onChange(n)}
              className="num flex items-center justify-center rounded-[10px] text-[15px]"
              style={{
                height: 44,
                background: active ? 'var(--accent)' : 'var(--surface-2)',
                color: active ? 'var(--accent-ink)' : 'var(--text)',
                fontWeight: active ? 700 : 500,
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="t-meta">rien</span>
        <span className="t-meta">très fort</span>
      </div>
    </div>
  )
}
