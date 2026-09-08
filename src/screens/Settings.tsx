import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Segmented } from '@/components/Segmented'
import { Toggle } from '@/components/Toggle'
import { SettingRow, SettingsSection } from '@/components/SettingRow'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { INTERVAL_CHOICES, RECOMMENDED_INTERVAL } from '@/lib/defaults'
import { BUNDLE_VERSION, isNativeUpdatePending } from '@/features/ota/updater'
import {
  PERMISSION_COPY,
  PERMISSION_ORDER,
  type PermissionKey,
  type PermissionState,
  readPermissions,
  requestPermission,
} from '@/features/reminders/permissions'
import { loadCues, setCues } from '@/features/session/cues'
import {
  PLACES,
  PLACE_LABEL,
  PLACE_NOTE,
  type Place,
  loadPlace,
  setPlace,
} from '@/features/place/place'
import { useContentStore } from '@/stores/content'
import { usePlanStore } from '@/stores/plan'
import { PLAN_MINUTES, emptyProfile } from '@/features/plan/profile'
import { suggestMobilityTimes } from '@/features/reminders/contextual'
import { readCompletionJournal } from '@/features/reminders/events'
import { PainScale } from '@/components/PainScale'
import { PAIN_ZONES, PAIN_ZONE_LABEL, ZONE_LABEL } from '@/content'
import { trackNow } from '@/features/analytics/events'
import type { PlanMinutes, Zone } from '@/lib/types'
import {
  ALERT_MODES,
  ALERT_MODE_LABEL,
  type AlertMode,
  MAX_VOLUME,
  MIN_VOLUME,
  VOLUME_STEP,
  loadAlertMode,
  loadAlertVolume,
  previewAlert,
  setAlertMode,
  setAlertVolume,
} from '@/features/reminders/alert'
import { canDuck } from '@/features/reminders/audiofocus'
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
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const authStatus = useAuthStore((s) => s.status)

  const [nativeUpdate, setNativeUpdate] = useState(false)
  useEffect(() => {
    void isNativeUpdatePending().then(setNativeUpdate)
  }, [])

  // The APK version, which the OTA never changes. It is the only way to tell
  // whether the shell installed is recent enough for the features that need a
  // native plugin — the row used to be blank on the device itself.
  const [nativeVersion, setNativeVersion] = useState<string | null>(null)
  useEffect(() => {
    if (!isNative()) return
    void App.getInfo()
      .then((info) => setNativeVersion(info.version))
      .catch(() => setNativeVersion(null))
  }, [])

  // The one hint left in this screen that is not a label or a value, kept
  // because it is a state rather than a lesson: `duckOthers` shipped in the APK
  // from 1.4.0, and on an older shell « Écouter » rings over the music and can
  // do nothing about it — which looks like a bug unless the screen says so.
  const volumeHint =
    isNative() && !canDuck() ? 'Cette version ne peut pas baisser ta musique' : undefined

  // The three grants a reminder needs. The sheet only appears when starting a
  // session, so this is where the state stays readable and fixable afterwards.
  const [permissions, setPermissions] = useState<PermissionState | null>(null)
  useEffect(() => {
    void readPermissions().then(setPermissions)
  }, [])

  async function grant(key: PermissionKey) {
    setPermissions(await requestPermission(key))
  }

  // Device-local: Settings is replaced wholesale by the server copy on /api/me.
  const [playerSound, setPlayerSound] = useState(true)
  useEffect(() => {
    void loadCues().then(setPlayerSound)
  }, [])

  const [alert, setAlert] = useState<AlertMode>('silent')
  useEffect(() => {
    void loadAlertMode().then(setAlert)
  }, [])

  const [volume, setVolume] = useState(80)
  useEffect(() => {
    void loadAlertVolume().then(setVolume)
  }, [])

  const refreshPlace = useContentStore((s) => s.refreshPlace)
  const [where, setWhere] = useState<Place>('bureau')
  useEffect(() => {
    void loadPlace().then(setWhere)
  }, [])

  // ---- The plan --------------------------------------------------------
  const profile = usePlanStore((s) => s.profile)
  const setProfile = usePlanStore((s) => s.setProfile)
  const rate = usePlanStore((s) => s.rate)
  const recompose = usePlanStore((s) => s.recompose)

  /** The zone whose scale is open, so adding one asks for its number at once. */
  const [rating, setRating] = useState<Zone | null>(null)

  /**
   * Half hours the person actually finishes sessions at, offered once there is
   * enough history to mean something. Never applied on its own: a reminder
   * that moves by itself is a reminder nobody trusts.
   */
  const [suggested, setSuggested] = useState<string[] | null>(null)
  useEffect(() => {
    void readCompletionJournal().then((done) => {
      const times = suggestMobilityTimes(done)
      // Nothing to offer when it already matches what is set.
      setSuggested(
        times && times.join() !== settings.mobilityTimes.join() ? times : null,
      )
    })
  }, [settings.mobilityTimes])

  async function setMinutes(minutes: PlanMinutes) {
    await setProfile({ ...(profile ?? emptyProfile()), minutes })
  }

  async function toggleZone(zone: Zone) {
    const base = profile ?? emptyProfile()
    const on = base.zones.includes(zone)
    const zones = on ? base.zones.filter((z) => z !== zone) : [...base.zones, zone]
    const baseline = { ...base.baseline }
    // Dropping a zone drops the number that came with it, but never the journal
    // entries: what was answered stays answered, and the history is still there
    // if the zone comes back.
    if (on) delete baseline[zone]
    await setProfile({ ...base, zones, baseline })
    setRating(on ? null : zone)
  }

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

      <SettingsSection title="Ton plan">
        <SettingRow label="Temps par jour" stacked>
          <Segmented
            ariaLabel="Temps disponible par jour"
            options={PLAN_MINUTES}
            value={profile?.minutes ?? 6}
            recommended={6}
            onChange={(v) => void setMinutes(v)}
            format={(v) => `${v} min`}
          />
        </SettingRow>

        <SettingRow label="Zones suivies" stacked>
          <div className="flex flex-wrap gap-1.5">
            {PAIN_ZONES.map((z) => {
              const on = (profile?.zones ?? []).includes(z)
              return (
                <button
                  key={z}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void toggleZone(z)}
                  className="rounded-full px-3 py-1.5 text-[13px]"
                  style={{
                    background: on ? 'var(--accent)' : 'var(--surface-2)',
                    color: on ? 'var(--accent-ink)' : 'var(--text)',
                    fontWeight: 700,
                  }}
                >
                  {ZONE_LABEL[z]}
                </button>
              )
            })}
          </div>
          {rating !== null && (
            <div className="mt-4">
              <p className="t-meta mb-2">
                {PAIN_ZONE_LABEL[rating]} — aujourd’hui, c’est combien&nbsp;?
              </p>
              <PainScale
                ariaLabel={`Douleur ${PAIN_ZONE_LABEL[rating]}, de 0 à 10`}
                value={null}
                onChange={(v) => {
                  void rate({ zone: rating, score: v, source: 'manual' })
                  setRating(null)
                }}
              />
            </div>
          )}
        </SettingRow>

        {suggested && (
          <SettingRow label="Rappels mobilité" stacked>
            <p className="t-meta">
              Tu bouges surtout vers {suggested.join(' et ')}. Tes rappels sont réglés sur{' '}
              {settings.mobilityTimes.join(' et ')}.
            </p>
            <button
              type="button"
              className="btn btn-secondary mt-3"
              onClick={() => {
                void update({ mobilityTimes: suggested })
                setSuggested(null)
              }}
            >
              Les caler sur ces heures
            </button>
          </SettingRow>
        )}
      </SettingsSection>

      <SettingsSection title="Session">
        <SettingRow label="Où tu travailles" stacked>
          <Segmented
            ariaLabel="Lieu de travail"
            options={PLACES}
            value={where}
            onChange={(v) => {
              setWhere(v)
              trackNow({ name: 'place_changed', place: v })
              void setPlace(v).then(() => {
                refreshPlace()
                // The discretion filter is an input to the composition, so the
                // plan is rebuilt rather than left claiming movements the new
                // place will not serve.
                recompose()
              })
            }}
            format={(v) => PLACE_LABEL[v]}
          />
          <p className="t-meta mt-2">{PLACE_NOTE[where]}</p>
        </SettingRow>
        <SettingRow label="Intervalle des rappels" stacked>
          <Segmented
            ariaLabel="Intervalle des rappels en minutes"
            options={INTERVAL_CHOICES}
            value={settings.intervalMin as (typeof INTERVAL_CHOICES)[number]}
            recommended={RECOMMENDED_INTERVAL}
            onChange={(v) => void update({ intervalMin: v })}
            format={(v) => `${v}`}
          />
        </SettingRow>

        <SettingRow label="Durée de pause" stacked>
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
          value={settings.autoStartAt}
          onChange={(autoStartAt) => void update({ autoStartAt })}
        />
      </SettingsSection>

      <SettingsSection title="Rappels">
        {permissions !== null &&
          PERMISSION_ORDER.map((key) => (
            <SettingRow
              key={key}
              label={PERMISSION_COPY[key].label}
              hint={permissions[key] ? 'Accordée' : 'Non accordée'}
            >
              {!permissions[key] && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void grant(key)}
                >
                  Autoriser
                </button>
              )}
            </SettingRow>
          ))}
        <SettingRow label="Rappels des yeux">
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
        <SettingRow label="Alarme du rappel" stacked>
          <Segmented
            ariaLabel="Insistance de l’alarme"
            options={ALERT_MODES}
            value={alert}
            onChange={(v) => {
              setAlert(v)
              void setAlertMode(v)
            }}
            format={(v) => ALERT_MODE_LABEL[v]}
          />
        </SettingRow>
        <SettingRow label="Volume de l’alarme" hint={volumeHint} stacked>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={MIN_VOLUME}
              max={MAX_VOLUME}
              step={VOLUME_STEP}
              value={volume}
              aria-label="Volume de l’alarme"
              onChange={(e) => {
                const v = Number(e.target.value)
                setVolume(v)
                void setAlertVolume(v)
              }}
              // Relâcher le curseur fait entendre le réglage : on ne règle pas
              // un volume à l'aveugle.
              onPointerUp={() => previewAlert()}
              onKeyUp={() => previewAlert()}
              className="min-w-0 flex-1"
              style={{ accentColor: 'var(--accent)', height: 32 }}
            />
            <span className="num shrink-0 text-[14px]" style={{ width: 40, color: 'var(--text-2)' }}>
              {volume}
            </span>
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              onClick={() => previewAlert()}
            >
              Écouter
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Sons du minuteur">
          <Toggle
            label="Sons du minuteur"
            checked={playerSound}
            onChange={(v) => {
              setPlayerSound(v)
              void setCues(v)
            }}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Compte">
        {authStatus === 'local' ? (
          <>
            <SettingRow label="Aucun compte" hint="Rien n’est synchronisé" />
            <div className="py-3.5">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-[16px] underline underline-offset-4"
                style={{ color: 'var(--accent)' }}
              >
                Créer un compte pour synchroniser
              </button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </SettingsSection>

      <SettingsSection title="À propos">
        <SettingRow label="Version du contenu (OTA)" hint={BUNDLE_VERSION} />
        <SettingRow
          label="Version de l’application"
          hint={isNative() ? (nativeVersion ?? '—') : 'navigateur'}
        />
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
          Log Off n’est pas un dispositif médical. En cas de douleur qui persiste, un médecin ou un
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
