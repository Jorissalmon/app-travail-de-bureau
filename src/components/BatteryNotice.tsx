import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { KEYS, getRaw, setRaw } from '@/lib/storage'
import { isNative } from '@/lib/platform'
import { requestExemption } from '@/features/reminders/battery'

/**
 * Shown once, after the first session start (§8.3): manufacturer battery
 * optimisation is what kills reminder apps. One short card, a button that opens
 * the OS setting, and a "don't show again" box. Never nags.
 */
export function BatteryNotice({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!open) return
    void (async () => {
      const seen = await getRaw(KEYS.batteryNoticeSeen)
      // Only relevant on device, and only once.
      if (seen === '1' || !isNative()) {
        onClose()
        return
      }
      setVisible(true)
    })()
  }, [open, onClose])

  async function dismiss(markSeen: boolean) {
    if (markSeen) await setRaw(KEYS.batteryNoticeSeen, '1')
    setVisible(false)
    onClose()
  }

  async function openSettings() {
    // Opens the system exemption dialog and only then marks the notice seen —
    // the card must not disappear as if it had done something when it did not.
    await requestExemption()
    await setRaw(KEYS.batteryNoticeSeen, '1')
    await dismiss(false)
  }

  return (
    <Sheet open={visible} onClose={() => void dismiss(true)} title="Pour que les rappels arrivent bien">
      <p className="t-body" style={{ color: 'var(--text-2)' }}>
        Certains téléphones mettent les apps en veille pour économiser la batterie, ce qui peut
        retarder ou bloquer les rappels. Autoriser Relève à tourner en arrière-plan règle le
        problème.
      </p>
      <button type="button" className="btn btn-accent btn-block mt-5" onClick={() => void openSettings()}>
        Ouvrir le réglage
      </button>
      <button type="button" className="tap mx-auto mt-3 block" onClick={() => void dismiss(true)}>
        <span className="t-meta underline underline-offset-4">Ne plus afficher</span>
      </button>
    </Sheet>
  )
}
