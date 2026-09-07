import { useCallback, useState } from 'react'
import { Sheet } from './Sheet'
import { PermissionsList } from './PermissionsList'
import { allGranted, type PermissionState } from '@/features/reminders/permissions'

/**
 * The gate in front of a work session (§8.3). The list itself is shared with
 * the welcome (`PermissionsList`); what this adds is the one thing particular
 * to starting a day — the button stays out of reach until nothing is missing.
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
  const onChange = useCallback((next: PermissionState) => setState(next), [])
  const ready = state !== null && allGranted(state)

  return (
    <Sheet open={open} onClose={onClose} title="Avant de démarrer">
      <p className="t-body" style={{ color: 'var(--text-2)' }}>
        Une session sans ces autorisations ne déclenche aucun rappel. Android les exige, et rien ici
        ne peut les contourner.
      </p>

      <div className="mt-5">
        <PermissionsList active={open} onChange={onChange} />
      </div>

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
