import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EvidencePill } from '@/components/EvidencePill'
import { FigureBadge } from '@/components/FigureBadge'
import { PermissionsList } from '@/components/PermissionsList'
import { Segmented } from '@/components/Segmented'
import { Wordmark } from '@/components/Wordmark'
import { useContentStore } from '@/stores/content'
import { useOnboardingStore } from '@/stores/onboarding'
import { PLACES, PLACE_LABEL, type Place, setPlace } from '@/features/place/place'
import { renderMarkdown } from '@/lib/markdown'

/**
 * The first opening, which did not exist.
 *
 * Four screens, in the order the questions actually arrive: what this is, why
 * thirty minutes rather than a round number someone made up, what Android has
 * to allow before any of it can work, and where you are working today. Then the
 * home screen, with its one button, meaning something.
 *
 * The second screen is the opening of « Pourquoi trente minutes », the article
 * the app already ships — read from the content store, so a correction to the
 * article reaches the welcome too and the two can never disagree.
 */

const INTRO_SLUG = 'pourquoi-30-minutes'

/** The article's opening paragraphs, minus the figure markers and the caveats. */
function opening(bodyMd: string, paragraphs: number): string {
  return bodyMd
    .split('\n\n')
    .filter((block) => !block.startsWith('::figure'))
    .slice(0, paragraphs)
    .join('\n\n')
}

export function Onboarding() {
  const navigate = useNavigate()
  const complete = useOnboardingStore((s) => s.complete)
  const article = useContentStore((s) => s.articleBySlug(INTRO_SLUG))
  const refreshPlace = useContentStore((s) => s.refreshPlace)

  const [step, setStep] = useState(0)
  const [where, setWhere] = useState<Place>('bureau')
  const body = useRef<HTMLDivElement>(null)

  // Each screen starts at its top, including the long one.
  useLayoutEffect(() => {
    body.current?.scrollTo({ top: 0, left: 0 })
  }, [step])

  const intro = useMemo(
    () => (article ? renderMarkdown(opening(article.bodyMd, 3)) : null),
    [article],
  )

  const steps = [
    {
      key: 'quoi',
      title: 'Une journée assise, coupée toutes les trente minutes.',
      body: (
        <div className="mt-5 flex flex-col gap-4">
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Tu démarres ta journée le matin. Log Off compte les intervalles et te propose de te
            lever, deux ou trois minutes à chaque fois. Tu réponds ce que tu veux : fait, plus tard,
            ou rien du tout. L’app note ce qui s’est réellement passé.
          </p>
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Elle ne mesure que ce que tu lui dis. Pas de calories, pas de bénéfice santé estimé,
            pas de félicitations. Ce que tu verras dans le suivi, c’est ton journal, rien de plus.
          </p>
          <div className="flex justify-center pt-2">
            <FigureBadge figureKey="marche" tone="lime" size={150} animated />
          </div>
        </div>
      ),
    },
    {
      key: 'pourquoi',
      title: article?.title ?? 'Pourquoi trente minutes',
      body: (
        <div className="mt-5">
          {article && (
            <div className="mb-3 flex items-center gap-2">
              <EvidencePill evidence={article.evidence} />
              <span className="t-meta">{article.readMin} min de lecture</span>
            </div>
          )}
          {intro ? (
            <div className="prose-releve" dangerouslySetInnerHTML={{ __html: intro }} />
          ) : (
            <p className="t-body" style={{ color: 'var(--text-2)' }}>
              Cinq minutes de marche toutes les trente minutes : le seul protocole qui a été comparé
              dose par dose.
            </p>
          )}
          <p className="t-meta mt-4">
            La suite et ses limites sont dans l’onglet Infos, avec dix autres articles. Chacun
            annonce son niveau de preuve, y compris quand il est faible.
          </p>
        </div>
      ),
    },
    {
      key: 'autorisations',
      title: 'Ce qu’Android doit autoriser.',
      body: (
        <div className="mt-5">
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Sans ces quatre-là, une session tourne sans qu’aucun rappel n’arrive. Autant les régler
            maintenant : une fois refusées, Android ne repose plus la question, et il faut aller les
            chercher soi-même dans ses réglages.
          </p>
          <div className="mt-5">
            <PermissionsList active={step === 2} />
          </div>
        </div>
      ),
    },
    {
      key: 'lieu',
      title: 'Où travailles-tu ?',
      body: (
        <div className="mt-5">
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Au bureau, l’app retire des routines les mouvements qu’on ne fait pas en open space :
            une fente, un étirement à l’encadrement de porte. À la maison, tout est proposé. Ça se
            change à tout moment dans le profil.
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
        </div>
      ),
    },
  ]

  const current = steps[step]
  const last = step === steps.length - 1

  async function finish() {
    await complete()
    navigate('/', { replace: true })
  }

  return (
    <div
      className="gutter flex min-h-0 flex-1 flex-col pb-8"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between pt-5">
        <Wordmark size={22} />
        <button
          type="button"
          className="t-meta"
          onClick={() => void finish()}
          style={{ color: 'var(--text-3)' }}
        >
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
            onClick={() => (last ? void finish() : setStep((n) => n + 1))}
          >
            {last ? 'Commencer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  )
}
