import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Check } from 'lucide-react'
import { isNative } from '@/lib/platform'
import {
  PERMISSION_COPY,
  PERMISSION_ORDER,
  type PermissionKey,
  type PermissionState,
  readPermissions,
  requestPermission,
} from '@/features/reminders/permissions'

/**
 * The four grants a reminder actually needs, each with the button that gets it
 * (§8.3). Every one of them hands off to a system screen the user has to come
 * back from, so the state is re-read on every return to the foreground: nobody
 * should have to guess whether it worked, or press anything to refresh.
 *
 * Shared by the sheet in front of a session and the welcome, so the two can
 * never drift into telling different stories about the same four switches.
 */
export function PermissionsList({
  active = true,
  onChange,
}: {
  /** False while the list is off screen, to stop it polling for nothing. */
  active?: boolean
  onChange?: (state: PermissionState) => void
}) {
  const [state, setState] = useState<PermissionState | null>(null)
  const [busy, setBusy] = useState<PermissionKey | null>(null)

  const refresh = useCallback(async () => {
    const next = await readPermissions()
    setState(next)
    onChange?.(next)
  }, [onChange])

  useEffect(() => {
    if (!active) return
    void refresh()
  }, [active, refresh])

  // Coming back from an Android settings screen must update the list by itself.
  useEffect(() => {
    if (!active || !isNative()) return
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refresh()
    })
    return () => {
      void handle.then((h) => h.remove())
    }
  }, [active, refresh])

  async function grant(key: PermissionKey) {
    setBusy(key)
    try {
      const next = await requestPermission(key)
      setState(next)
      onChange?.(next)
    } finally {
      setBusy(null)
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {PERMISSION_ORDER.map((key) => {
        const granted = state?.[key] ?? false
        return (
          <li
            key={key}
            className="flex items-center gap-3 rounded-[16px] p-3"
            style={{ background: 'var(--surface-2)' }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[16px]">{PERMISSION_COPY[key].label}</p>
              <p className="t-meta mt-0.5">{PERMISSION_COPY[key].why}</p>
            </div>
            {granted ? (
              <span
                className="flex shrink-0 items-center gap-1.5"
                style={{ color: 'var(--accent)' }}
                aria-label="Accordée"
              >
                <Check size={18} aria-hidden="true" />
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-secondary shrink-0"
                disabled={busy !== null}
                onClick={() => void grant(key)}
              >
                {busy === key ? 'Un instant…' : 'Autoriser'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
