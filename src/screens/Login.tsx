import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wordmark } from '@/components/Wordmark'
import { HttpError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

/**
 * §11.7 — one screen, black ground, the wordmark, no illustration, no
 * marketing slogan.
 *
 * What changed is what it leads with. It used to open on a login form with an
 * invite code, which meant the very first thing the app ever asked was for an
 * account — before it had said what it does, before a single reminder had
 * fired, and, for a new phone with the database asleep, before it would open at
 * all. An account synchronises two devices; it has never been what makes you
 * stand up. So the accent button starts the app, and the form is one tap behind
 * it for whoever actually wants to sync.
 */
export function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const startWithoutAccount = useAuthStore((s) => s.startWithoutAccount)

  const [showForm, setShowForm] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      await startWithoutAccount()
      navigate('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
      } else {
        await register(email.trim(), password, displayName.trim(), inviteCode.trim())
      }
      navigate('/', { replace: true })
    } catch (err) {
      // An HttpError means the server answered and its message is displayable.
      // Anything else is a network failure — say so, rather than blaming credentials.
      setError(
        err instanceof HttpError
          ? err.message
          : 'Impossible de joindre le serveur. Vérifie ta connexion.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-center"
      style={{
        background: 'var(--bg)',
        paddingTop: 'calc(env(safe-area-inset-top,0px) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)',
      }}
    >
      <div className="gutter mx-auto w-full" style={{ maxWidth: 420 }}>
        <h1 className="mb-3">
          <Wordmark size={38} />
        </h1>
        <p className="t-meta mb-9">Lève-toi. L’app s’occupe du reste.</p>

        {!showForm && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="btn btn-accent btn-block"
              disabled={busy}
              onClick={() => void start()}
            >
              Commencer
            </button>
            <p className="t-meta">
              Aucun compte n’est nécessaire. Tes réglages, tes routines et tes chiffres restent sur
              ce téléphone. Un compte, plus tard, ne sert qu’à les retrouver sur un autre appareil.
            </p>
            <button
              type="button"
              className="tap mx-auto mt-4 block"
              onClick={() => setShowForm(true)}
            >
              <span className="t-meta underline underline-offset-4">
                J’ai déjà un compte, ou j’en veux un
              </span>
            </button>
          </div>
        )}

        {showForm && (
          <>
            <form onSubmit={submit} className="flex flex-col gap-3">
              {mode === 'register' && (
                <Field
                  label="Nom"
                  value={displayName}
                  onChange={setDisplayName}
                  autoComplete="name"
                  required
                />
              )}
              <Field
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                inputMode="email"
                required
              />
              <Field
                label="Mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              {mode === 'register' && (
                <Field
                  label="Code d’invitation"
                  value={inviteCode}
                  onChange={setInviteCode}
                  autoComplete="off"
                  required
                />
              )}

              {error && (
                <p className="t-meta" role="alert" style={{ color: 'var(--danger)' }}>
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-accent btn-block mt-2" disabled={busy}>
                {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </button>
            </form>

            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                type="button"
                className="tap block"
                onClick={() => {
                  setMode((m) => (m === 'login' ? 'register' : 'login'))
                  setError(null)
                }}
              >
                <span className="t-meta underline underline-offset-4">
                  {mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}
                </span>
              </button>
              <button
                type="button"
                className="tap block"
                onClick={() => {
                  setShowForm(false)
                  setError(null)
                }}
              >
                <span className="t-meta underline underline-offset-4">Continuer sans compte</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  ...rest
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'>) {
  return (
    <label className="block">
      <span className="t-meta mb-1.5 block">{label}</span>
      <input
        {...rest}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full rounded-[16px] px-4 py-3.5 text-[16px] outline-none"
        style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
      />
    </label>
  )
}
