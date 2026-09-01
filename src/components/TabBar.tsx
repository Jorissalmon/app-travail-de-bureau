import { NavLink } from 'react-router-dom'
import { BarChart2, Bookmark, Home, Sparkles, User } from 'lucide-react'

/** §11 — five tabs, icons only, black ground, respects the bottom safe area. */
const TABS = [
  { to: '/', Icon: Home, label: 'Aujourd’hui' },
  { to: '/library', Icon: Bookmark, label: 'Routines' },
  { to: '/articles', Icon: Sparkles, label: 'Infos' },
  { to: '/stats', Icon: BarChart2, label: 'Suivi' },
  { to: '/settings', Icon: User, label: 'Profil' },
] as const

export function TabBar() {
  return (
    <nav
      aria-label="Navigation principale"
      className="sticky bottom-0 z-30 shrink-0"
      style={{
        background: 'var(--bg)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map(({ to, Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              aria-label={label}
              className="tap w-full flex-col py-2.5"
              style={{ minHeight: 56 }}
            >
              {({ isActive }) => (
                <Icon
                  size={24}
                  strokeWidth={2}
                  color={isActive ? 'var(--text)' : 'var(--text-3)'}
                  aria-hidden="true"
                />
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
