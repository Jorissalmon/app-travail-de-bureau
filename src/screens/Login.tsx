import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HttpError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

/**
 * §11.7 — one screen, black ground, the wordmark, two fields, one accent
 * button, and a discreet "créer un compte" that unfolds the invite-code field.
 * No illustration, no marketing slogan.
 */
export function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(err instanceof HttpError ? err.message : 'Connexion impossible. Réessaie.')
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
        <h1 className="t-day mb-10">Relève</h1>

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

        <button
          type="button"
          className="tap mx-auto mt-5 block"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'))
            setError(null)
          }}
        >
          <span className="t-meta underline underline-offset-4">
            {mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}
          </span>
        </button>
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
