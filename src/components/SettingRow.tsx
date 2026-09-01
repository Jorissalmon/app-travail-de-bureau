import type { ReactNode } from 'react'

export function SettingRow({
  label,
  hint,
  children,
  stacked = false,
}: {
  label: string
  hint?: string
  children?: ReactNode
  stacked?: boolean
}) {
  return (
    <div
      className={stacked ? 'py-3.5' : 'flex items-center justify-between gap-3 py-3.5'}
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="min-w-0">
        <p className="text-[16px]">{label}</p>
        {hint && <p className="t-meta mt-0.5">{hint}</p>}
      </div>
      <div className={stacked ? 'mt-3' : 'shrink-0'}>{children}</div>
    </div>
  )
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="t-section mb-1.5">{title}</h2>
      <div className="rounded-[20px] px-4" style={{ background: 'var(--surface)' }}>
        {children}
      </div>
    </section>
  )
}
