import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { FigureBadge } from '@/components/FigureBadge'
import { PainScale } from '@/components/PainScale'
import { PlanCard } from '@/components/PlanCard'
import { Segmented } from '@/components/Segmented'
import { Wordmark } from '@/components/Wordmark'
import { useOnboardingStore } from '@/stores/onboarding'
import { usePlanStore } from '@/stores/plan'
import { useContentStore } from '@/stores/content'
import { PAIN_ZONES, PAIN_ZONE_LABEL, ZONES } from '@/content'
import { PLACES, PLACE_LABEL, PLACE_NOTE, type Place, setPlace } from '@/features/place/place'
import { DURATION_LABEL, LONG_STANDING, PLAN_MINUTES } from '@/features/plan/profile'
import { PLAN_SLUG } from '@/features/plan/compose'
import { trackNow } from '@/features/analytics/events'
import type { PainDuration, PainProfile, PlanMinutes, Zone } from '@/lib/types'

/**
 * The first run, rebuilt around the pivot.
 *
 * It used to explain the app: what it does, why thirty minutes, what Android
 * has to allow, where you work. Four screens of reading before anything
 * happened, and the thing that happened was a timer.
 *
 * It now asks four questions and produces a session. The target is a first plan
 * on screen in under ninety seconds, measured on `onboarding_completed` and on
 * nothing else — so there is one short screen of what-this-is, then the
 * questions, then the plan with its start button.
 *
 * What moved out: the Android permissions screen. It gated the first session
 * behind four system dialogs, and the reminders it protects only matter from
 * the second day. The home screen still opens the same sheet the moment a
 * session needs a grant it does not have, which is the moment the ask makes
 * sense.
 */

type StepKey = 'quoi' | 'zones' | 'since' | 'place' | 'minutes' | 'plan'

export function Onboarding() {
  const navigate = useNavigate()
  const complete = useOnboardingStore((s) => s.complete)
  const refreshPlace = useContentStore((s) => s.refreshPlace)
  const plan = usePlanStore((s) => s.plan)
  const setProfile = usePlanStore((s) => s.setProfile)
  const rate = usePlanStore((s) => s.rate)

  const [step, setStep] = useState(0)
  const [zones, setZones] = useState<Zone[]>([])
  const [scores, setScores] = useState<Partial<Record<Zone, number>>>({})
  const [since, setSince] = useState<PainDuration | null>(null)
  const [where, setWhere] = useState<Place>('bureau')
  const [minutes, setMinutes] = useState<PlanMinutes>(6)
  const [saving, setSaving] = useState(false)

  const body = useRef<HTMLDivElement>(null)
  // Wall clock from the first paint: the « moins de 90 secondes » claim is
  // checked against this, so it starts where the user's first second does.
  const openedAt = useRef(Date.now())
  const started = useRef(false)
  if (!started.current) {
    started.current = true
    trackNow({ name: 'onboarding_started' })
  }

  useLayoutEffect(() => {
    body.current?.scrollTo({ top: 0, left: 0 })
  }, [step])

  const zoneLabel = (z: Zone) => ZONES.find((m) => m.zone === z)?.label ?? z
  const figureFor = (z: Zone) => ZONES.find((m) => m.zone === z)?.figureKey ?? 'marche'

  function toggleZone(zone: Zone) {
    setZones((prev) => (prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]))
    setScores((prev) => {
      if (prev[zone] !== undefined) {
        const next = { ...prev }
        delete next[zone]
        return next
      }
      // Nothing is pre-filled: a default of five would put a number in someone's
      // mouth, and every number this app shows has to be one they typed.
      return prev
    })
  }

  /** Zones picked but not yet rated — the only thing that blocks « Suivant ». */
  const unrated = zones.filter((z) => scores[z] === undefined)

  const steps: { key: StepKey; title: string; body: React.ReactNode; canAdvance: boolean }[] = [
    {
      key: 'quoi',
      title: 'Une séance courte, réglée sur ce qui te fait mal.',
      canAdvance: true,
      body: (
        <div className="mt-5 flex flex-col gap-4">
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Quatre questions, puis une séance de quatre à huit minutes composée pour tes zones. À
            la fin, l’app te demande où tu en es, et le plan du lendemain change en fonction de ta
            réponse.
          </p>
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Elle ne mesure que ce que tu lui dis. Pas de score, pas de bénéfice santé estimé, pas
            de félicitations. Chaque article annonce son niveau de preuve, y compris quand il est
            faible.
          </p>
          <p className="t-meta">
            Log Off n’est pas un dispositif médical. En cas de douleur qui persiste, un médecin ou
            un kiné tranchera mieux qu’une app.
          </p>
          <div className="flex justify-center pt-1">
            <FigureBadge figureKey="menton-rentre" tone="sky" size={140} animated />
          </div>
        </div>
      ),
    },
    {
      key: 'zones',
      title: 'Où as-tu mal ?',
      canAdvance: zones.length === 0 || unrated.length === 0,
      body: (
        <div className="mt-5">
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Choisis ce qui te gêne aujourd’hui, puis pose un chiffre dessus. Tu peux n’en choisir
            aucune : la séance sera un entretien général.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {PAIN_ZONES.map((z) => {
              const on = zones.includes(z)
              return (
                <button
                  key={z}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleZone(z)}
                  className="flex items-center gap-2.5 rounded-[14px] px-3 py-3 text-left"
                  style={{
                    background: on ? 'var(--surface-3)' : 'var(--surface)',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <FigureBadge figureKey={figureFor(z)} tone={on ? 'lime' : 'slate'} size={34} />
                  <span className="min-w-0 flex-1 truncate text-[15px]" style={{ fontWeight: 700 }}>
                    {zoneLabel(z)}
                  </span>
                  {on && <Check size={16} color="var(--accent)" aria-hidden="true" />}
                </button>
              )
            })}
          </div>

          {zones.map((z) => (
            <div key={z} className="mt-6">
              <p className="t-section mb-2">
                {zoneLabel(z)} — aujourd’hui, c’est combien&nbsp;?
              </p>
              <PainScale
                ariaLabel={`Douleur ${PAIN_ZONE_LABEL[z] ?? z}, de 0 à 10`}
                value={scores[z] ?? null}
                onChange={(v) => setScores((prev) => ({ ...prev, [z]: v }))}
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'since',
      title: 'Depuis combien de temps ?',
      canAdvance: true,
      body: (
        <div className="mt-5">
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Ça ne change pas la séance. Ça change ce que l’app te dit d’en attendre.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {(Object.keys(DURATION_LABEL) as PainDuration[]).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={since === d}
                onClick={() => setSince(d)}
                className="rounded-[14px] px-4 py-3.5 text-left text-[16px]"
                style={{
                  background: since === d ? 'var(--surface-3)' : 'var(--surface)',
                  border: `1px solid ${since === d ? 'var(--accent)' : 'var(--border)'}`,
                  fontWeight: 700,
                }}
              >
                {DURATION_LABEL[d]}
              </button>
            ))}
          </div>
          {since === LONG_STANDING && (
            <p className="t-meta mt-4">
              Plus de six mois, c’est une douleur qui mérite un avis. Cette app peut
              t’accompagner ; elle ne remplacera pas le kiné ou le médecin qui posera un
              diagnostic.
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'place',
      title: 'Tu travailles où ?',
      canAdvance: true,
      body: (
        <div className="mt-5">
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Ça décide de ce que l’app ose te proposer. En open space, elle ne servira que des
            mouvements que personne ne remarque. Ça se change à tout moment dans le profil.
          </p>
          <div className="mt-5">
            <Segmented
              ariaLabel="Lieu de travail"
              options={PLACES}
              value={where}
              onChange={(v) => {
                setWhere(v)
                void setPlace(v).then(refreshPlace)
              }}
              format={(v) => PLACE_LABEL[v]}
            />
          </div>
          <p className="t-meta mt-3">{PLACE_NOTE[where]}</p>
        </div>
      ),
    },
    {
      key: 'minutes',
      title: 'Combien de temps par jour ?',
      canAdvance: true,
      body: (
        <div className="mt-5">
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Prends le chiffre que tu tiendras un mardi chargé, pas celui qui te ferait plaisir. Le
            plan sera composé pour tenir exactement dans ce temps-là.
          </p>
          <div className="mt-5">
            <Segmented
              ariaLabel="Temps disponible par jour"
              options={PLAN_MINUTES}
              value={minutes}
              onChange={setMinutes}
              format={(v) => `${v} min`}
              recommended={6}
            />
          </div>
          <p className="t-meta mt-3">
            Quatre minutes suffisent pour de la mobilité seule. À partir de six, le plan peut
            ajouter un deuxième mouvement de renforcement quand tes réponses baissent.
          </p>
        </div>
      ),
    },
    {
      key: 'plan',
      title: 'Voilà ta première séance.',
      canAdvance: true,
      body: (
        <div className="mt-5">
          {plan ? (
            <PlanCard plan={plan} onStart={() => void finish(true)} busy={saving} />
          ) : (
            <p className="t-body" style={{ color: 'var(--text-2)' }}>
              Composition en cours…
            </p>
          )}
          <p className="t-meta mt-4">
            À la fin, une question : « comment est ta zone maintenant ? ». C’est la seule mesure de
            cette app, et c’est toi qui la donnes.
          </p>
        </div>
      ),
    },
  ]

  const current = steps[step]
  const last = step === steps.length - 1

  /**
   * Everything the questions collected, written before the plan is previewed.
   *
   * `startedAt` is fixed at the first render rather than read inside the memo:
   * it is the anchor the plan rotates its movement pools on, and a value that
   * moved with every tap would have been a different anchor each time the memo
   * re-ran.
   */
  const startedAt = useRef(new Date().toISOString())
  const draft: PainProfile = useMemo(
    () => ({
      zones: [...zones].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0)),
      baseline: scores,
      since,
      minutes,
      startedAt: startedAt.current,
    }),
    [zones, scores, since, minutes],
  )

  async function commit() {
    await setProfile(draft)
    // The first-run ratings are entries like any other: the D0 of every delta
    // the app will ever show is an answer the person gave, not a baseline the
    // app assigned.
    for (const z of draft.zones) {
      const score = scores[z]
      if (score !== undefined) await rate({ zone: z, score, source: 'onboarding' })
    }
  }

  async function next() {
    const key = current?.key
    if (key && key !== 'quoi') trackNow({ name: 'onboarding_step', step: key as never })
    // The profile is written before the preview so the card shows the real
    // composition, not a mock of one.
    if (key === 'minutes') await commit()
    setStep((n) => n + 1)
  }

  async function finish(startNow: boolean) {
    setSaving(true)
    try {
      if (!usePlanStore.getState().profile) await commit()
      trackNow({
        name: 'onboarding_completed',
        seconds: Math.round((Date.now() - openedAt.current) / 1000),
        zones: draft.zones.length,
        maxPain: Math.max(0, ...Object.values(scores)),
        minutes,
        place: where,
      })
      await complete()
      navigate(startNow ? `/player/${PLAN_SLUG}?from=onboarding` : '/', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  function skip() {
    trackNow({ name: 'onboarding_abandoned', step: current?.key ?? 'inconnu' })
    void finish(false)
  }

  return (
    <div
      className="gutter flex min-h-0 flex-1 flex-col pb-8"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between pt-5">
        <Wordmark size={22} />
        <button type="button" className="t-meta" onClick={skip} style={{ color: 'var(--text-3)' }}>
          Passer
        </button>
      </div>

      <div ref={body} className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-6">
        <h1 className="t-screen">{current?.title}</h1>
        {current?.body}
      </div>

      <div className="pt-5">
        <ol
          className="mb-4 flex justify-center gap-1.5"
          aria-label={`Étape ${step + 1} sur ${steps.length}`}
        >
          {steps.map((s, i) => (
            <li
              key={s.key}
              aria-current={i === step ? 'step' : undefined}
              className="h-1 w-6 rounded-full"
              style={{ background: i <= step ? 'var(--accent)' : 'var(--surface-3)' }}
            />
          ))}
        </ol>
        <div className="flex gap-2.5">
          {step > 0 && (
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={() => setStep((n) => n - 1)}
            >
              Retour
            </button>
          )}
          <button
            type="button"
            className="btn btn-accent flex-1"
            disabled={!(current?.canAdvance ?? true) || saving}
            onClick={() => (last ? void finish(false) : void next())}
          >
            {last ? 'Plus tard' : 'Suivant'}
          </button>
        </div>
        {current?.key === 'zones' && unrated.length > 0 && (
          <p className="t-meta mt-3 text-center">
            Pose un chiffre sur {unrated.map(zoneLabel).join(', ').toLowerCase()} pour continuer.
          </p>
        )}
      </div>
    </div>
  )
}
