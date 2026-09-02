import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Check } from 'lucide-react'
import { Sheet } from './Sheet'
import { isNative } from '@/lib/platform'
import {
  PERMISSION_COPY,
  PERMISSION_ORDER,
  type PermissionKey,
  type PermissionState,
  allGranted,
  readPermissions,
  requestPermission,
} from '@/features/reminders/permissions'

/**
 * The gate in front of a work session (§8.3). Every line grants one thing and,
 * when Android has already recorded a refusal, lands the user on the settings
 * screen that can undo it.
 *
 * Most of these hand off to a system screen, so the state is re-read every time
 * the app comes back to the foreground — the user should never have to guess
 * whether it worked, or press anything to refresh.
 */
export function PermissionsSheet({
  open,
  onClose,
  onAllGranted,
}: {
  open: boolean
  onClose: () => void
  /** Called once everything is granted, so the caller can start the session. */
  onAllGranted: () => void
}) {
  const [state, setState] = useState<PermissionState | null>(null)
  const [busy, setBusy] = useState<PermissionKey | null>(null)

  const refresh = useCallback(async () => {
    const next = await readPermissions()
    setState(next)
    return next
  }, [])

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open, refresh])

  // Coming back from an Android settings screen must update the sheet by itself.
  useEffect(() => {
    if (!open || !isNative()) return
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refresh()
    })
    return () => {
      void handle.then((h) => h.remove())
    }
  }, [open, refresh])

  async function grant(key: PermissionKey) {
    setBusy(key)
    try {
      setState(await requestPermission(key))
    } finally {
      setBusy(null)
    }
  }

  const ready = state !== null && allGranted(state)

  return (
    <Sheet open={open} onClose={onClose} title="Avant de démarrer">
      <p className="t-body" style={{ color: 'var(--text-2)' }}>
        Une session sans ces autorisations ne déclenche aucun rappel. Android les exige, et rien
        ici ne peut les contourner.
      </p>

      <ul className="mt-5 flex flex-col gap-2">
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

      <button
        type="button"
        className="btn btn-accent btn-block mt-5"
        disabled={!ready}
        onClick={onAllGranted}
      >
        {ready ? 'Démarrer la session' : 'Autorise tout pour continuer'}
      </button>
    </Sheet>
  )
}
