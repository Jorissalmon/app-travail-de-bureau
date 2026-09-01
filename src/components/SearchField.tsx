import { Search, X } from 'lucide-react'

export function SearchField({
  value,
  onChange,
  placeholder = 'Rechercher une routine',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-full px-4 ${className ?? ''}`}
      style={{ background: 'var(--surface-2)', minHeight: 48 }}
    >
      <Search size={18} strokeWidth={2} color="var(--text-2)" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none placeholder:text-[var(--text-2)]"
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => onChange('')}
          className="tap -mr-2"
        >
          <X size={18} strokeWidth={2} color="var(--text-2)" />
        </button>
      )}
    </div>
  )
}
