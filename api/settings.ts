import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db'
import { ApiError, body, fail, json, methods } from './_http'
import { requireUser } from './_auth'
import { toSettings } from './_models'
import { optionalHHMM } from './_validate'

/** Columns the client may set, with their validators. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const m = methods(req, 'GET', 'PUT')
    const { sub } = await requireUser(req)
    const sql = db()

    if (m === 'GET') {
      let rows = await sql`SELECT * FROM settings WHERE user_id = ${sub} LIMIT 1`
      if (rows.length === 0) {
        rows = await sql`INSERT INTO settings (user_id) VALUES (${sub}) RETURNING *`
      }
      json(res, 200, toSettings(rows[0]!))
      return
    }

    const b = body<Record<string, unknown>>(req)

    // Read current row, apply only provided fields, write back. One UPDATE with
    // COALESCE-style merging keeps partial PUTs simple and safe.
    const cur = (await sql`SELECT * FROM settings WHERE user_id = ${sub} LIMIT 1`)[0]
    if (!cur) {
      await sql`INSERT INTO settings (user_id) VALUES (${sub})`
    }

    const intervalMin = clampInt(b.intervalMin, 15, 90, cur?.interval_min)
    const breakMinutes = clampInt(b.breakMinutes, 1, 10, cur?.break_minutes)
    const eyeReminders = asBool(b.eyeReminders, cur?.eye_reminders)
    const sound = asBool(b.sound, cur?.sound)
    const vibrate = asBool(b.vibrate, cur?.vibrate)
    const quietStart = optionalHHMM(b.quietStart, 'début du silence')
    const quietEnd = optionalHHMM(b.quietEnd, 'fin du silence')
    const autoStartAt = optionalHHMM(b.autoStartAt, 'démarrage auto')
    const mobilityTimes = asTimeArray(b.mobilityTimes)
    const weekdays = asWeekdays(b.weekdays)

    const rows = await sql`
      UPDATE settings SET
        interval_min   = ${intervalMin},
        break_minutes  = ${breakMinutes},
        eye_reminders  = ${eyeReminders},
        sound          = ${sound},
        vibrate        = ${vibrate},
        quiet_start    = ${quietStart === undefined ? cur?.quiet_start ?? null : quietStart},
        quiet_end      = ${quietEnd === undefined ? cur?.quiet_end ?? null : quietEnd},
        auto_start_at  = ${autoStartAt === undefined ? cur?.auto_start_at ?? null : autoStartAt},
        mobility_times = ${mobilityTimes ?? cur?.mobility_times ?? ['10:30', '15:30']},
        weekdays       = ${weekdays ?? cur?.weekdays ?? [1, 2, 3, 4, 5]},
        updated_at     = now()
      WHERE user_id = ${sub}
      RETURNING *
    `
    json(res, 200, toSettings(rows[0]!))
  } catch (e) {
    fail(res, e)
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: unknown): number {
  if (v === undefined || v === null) return Number(fallback)
  const n = Math.round(Number(v))
  if (Number.isNaN(n)) throw new ApiError(400, 'invalid_input', 'Valeur numérique invalide.')
  return Math.min(max, Math.max(min, n))
}

function asBool(v: unknown, fallback: unknown): boolean {
  if (v === undefined) return Boolean(fallback)
  return Boolean(v)
}

function asTimeArray(v: unknown): string[] | undefined {
  if (v === undefined) return undefined
  if (!Array.isArray(v)) throw new ApiError(400, 'invalid_input', 'Liste d’heures invalide.')
  return v.map((t) => {
    if (typeof t !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
      throw new ApiError(400, 'invalid_input', 'Heure de mobilité invalide.')
    }
    return t
  })
}

function asWeekdays(v: unknown): number[] | undefined {
  if (v === undefined) return undefined
  if (!Array.isArray(v)) throw new ApiError(400, 'invalid_input', 'Jours invalides.')
  const days = v.map(Number).filter((n) => n >= 1 && n <= 7)
  return Array.from(new Set(days)).sort((a, b) => a - b)
}
