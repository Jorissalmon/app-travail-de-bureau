import { ApiError } from './_http.js'

/** Small input guards. Keep the messages French and displayable (§6). */

export function requireString(v: unknown, field: string, max = 500): string {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ApiError(400, 'invalid_input', `Le champ « ${field} » est requis.`)
  }
  if (v.length > max) {
    throw new ApiError(400, 'invalid_input', `Le champ « ${field} » est trop long.`)
  }
  return v.trim()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function requireEmail(v: unknown): string {
  const s = requireString(v, 'e-mail', 320).toLowerCase()
  if (!EMAIL_RE.test(s)) {
    throw new ApiError(400, 'invalid_email', 'Cette adresse e-mail n’est pas valide.')
  }
  return s
}

export function requirePassword(v: unknown): string {
  if (typeof v !== 'string' || v.length < 10) {
    throw new ApiError(400, 'weak_password', 'Le mot de passe doit faire au moins 10 caractères.')
  }
  if (v.length > 200) {
    throw new ApiError(400, 'invalid_input', 'Le mot de passe est trop long.')
  }
  return v
}

export function optionalHHMM(v: unknown, field: string): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) {
    throw new ApiError(400, 'invalid_input', `L’heure « ${field} » n’est pas valide.`)
  }
  return v
}
