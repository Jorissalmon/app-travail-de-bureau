import { useEffect, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { Segmented } from '@/components/Segmented'
import { Toggle } from '@/components/Toggle'
import { SettingRow, SettingsSection } from '@/components/SettingRow'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { INTERVAL_CHOICES, RECOMMENDED_INTERVAL } from '@/lib/defaults'
import { BUNDLE_VERSION, isNativeUpdatePending } from '@/features/ota/updater'
import { isNative } from '@/lib/platform'

const REPO_URL = 'https://github.com/Jorissalmon/app-travail-de-bureau'
const WEEKDAYS = [
  { n: 1, l: 'L' },
  { n: 2, l: 'M' },
  { n: 3, l: 'M' },
  { n: 4, l: 'J' },
  { n: 5, l: 'V' },
  { n: 6, l: 'S' },
  { n: 7, l: 'D' },
] as const

/** §11.6 — Profil: Session · Rappels · Compte · À propos. */
export function Settings() {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [nativeUpdate, setNativeUpdate] = useState(false)
  useEffect(() => {
    void isNativeUpdatePending().then(setNativeUpdate)
  }, [])

  function toggleWeekday(n: number) {
    const set = new Set(settings.weekdays)
    if (set.has(n)) set.delete(n)
    else set.add(n)
    void update({ weekdays: Array.from(set).sort((a, b) => a - b) })
  }

  return (
    <div className="gutter pb-10">
      <h1 className="t-screen pt-5 pb-1">Profil</h1>

      {nativeUpdate && (
        <div
          className="mt-4 rounded-[16px] p-4"
          style={{ background: 'var(--surface-2)' }}
          role="status"
        >
          <p className="text-[15px]">Une nouvelle version de l’application est à installer.</p>
          <button
            type="button"
            onClick={() => void openRepo()}
            className="mt-2 text-[14px] underline underline-offset-4"
            style={{ color: 'var(--accent)' }}
          >
            Télécharger l’APK
          </button>
        </div>
      )}

      <SettingsSection title="Session">
        <SettingRow label="Intervalle des rappels" hint="30 minutes est l’intervalle recommandé." stacked>
          <Segmented
            ariaLabel="Intervalle des rappels en minutes"
            options={INTERVAL_CHOICES}
            value={settings.intervalMin as (typeof INTERVAL_CHOICES)[number]}
            recommended={RECOMMENDED_INTERVAL}
            onChange={(v) => void update({ intervalMin: v })}
            format={(v) => `${v}`}
          />
        </SettingRow>

        <SettingRow label="Durée de pause" hint="Minutes conseillées pour chaque pause." stacked>
          <Segmented
            ariaLabel="Durée de pause en minutes"
            options={[1, 2, 3, 5, 10] as const}
            value={settings.breakMinutes as 1 | 2 | 3 | 5 | 10}
            onChange={(v) => void update({ breakMinutes: v })}
          />
        </SettingRow>

        <SettingRow label="Jours actifs" stacked>
          <div className="flex gap-1.5">
            {WEEKDAYS.map(({ n, l }) => {
              const on = settings.weekdays.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Jour ${n}`}
                  onClick={() => toggleWeekday(n)}
                  className="flex-1 rounded-[10px] py-2 text-[14px] font-700"
                  style={{
                    background: on ? 'var(--accent)' : 'var(--surface-2)',
                    color: on ? 'var(--accent-ink)' : 'var(--text-2)',
                    fontWeight: 700,
                  }}
                >
                  {l}
                </button>
              )
            })}
          </div>
        </SettingRow>

        <TimeRangeRow
          label="Plage silencieuse"
          start={settings.quietStart}
          end={settings.quietEnd}
          onChange={(quietStart, quietEnd) => void update({ quietStart, quietEnd })}
        />

        <TimeRow
          label="Démarrage auto"
          hint="Laisse vide pour démarrer à la main."
          value={settings.autoStartAt}
          onChange={(autoStartAt) => void update({ autoStartAt })}
        />
      </SettingsSection>

      <SettingsSection title="Rappels">
        <SettingRow label="Rappels des yeux" hint="Désactivé par défaut. Voir l’article dédié.">
          <Toggle
            label="Rappels des yeux"
            checked={settings.eyeReminders}
            onChange={(v) => void update({ eyeReminders: v })}
          />
        </SettingRow>
        <SettingRow label="Vibration">
          <Toggle
            label="Vibration"
            checked={settings.vibrate}
            onChange={(v) => void update({ vibrate: v })}
          />
        </SettingRow>
        <SettingRow label="Son" hint="Désactivé par défaut (open space).">
          <Toggle label="Son" checked={settings.sound} onChange={(v) => void update({ sound: v })} />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Compte">
        <SettingRow label="E-mail" hint={user?.email ?? '—'} />
        <div className="py-3.5">
          <button
            type="button"
            onClick={() => void logout()}
            className="text-[16px]"
            style={{ color: 'var(--danger)' }}
          >
            Se déconnecter
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="À propos">
        <SettingRow label="Version du contenu (OTA)" hint={BUNDLE_VERSION} />
        <SettingRow label="Version de l’application" hint={isNative() ? undefined : 'navigateur'} />
        <div className="py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => void openRepo()}
            className="text-[16px] underline underline-offset-4"
            style={{ color: 'var(--accent)' }}
          >
            Dépôt du projet
          </button>
        </div>
        <p className="t-meta py-4">
          Relève n’est pas un dispositif médical. En cas de douleur qui persiste, un médecin ou un
          kiné tranchera mieux qu’une app.
        </p>
      </SettingsSection>
    </div>
  )
}

async function openRepo() {
  if (isNative()) await Browser.open({ url: REPO_URL })
  else window.open(REPO_URL, '_blank', 'noopener,noreferrer')
}

function TimeRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <SettingRow label={label} hint={hint}>
      <input
        type="time"
        value={value ?? ''}
        aria-label={label}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-[10px] px-3 py-1.5 text-[15px]"
        style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
      />
    </SettingRow>
  )
}

function TimeRangeRow({
  label,
  start,
  end,
  onChange,
}: {
  label: string
  start: string | null
  end: string | null
  onChange: (start: string | null, end: string | null) => void
}) {
  return (
    <div className="py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <p className="text-[16px]">{label}</p>
      <p className="t-meta mt-0.5">Aucun rappel pendant cette plage.</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="time"
          value={start ?? ''}
          aria-label={`${label} — début`}
          onChange={(e) => onChange(e.target.value || null, end)}
          className="flex-1 rounded-[10px] px-3 py-2 text-[15px]"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        />
        <span className="t-meta">→</span>
        <input
          type="time"
          value={end ?? ''}
          aria-label={`${label} — fin`}
          onChange={(e) => onChange(start, e.target.value || null)}
          className="flex-1 rounded-[10px] px-3 py-2 text-[15px]"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        />
      </div>
    </div>
  )
}
