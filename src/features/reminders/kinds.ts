import type { ReminderKind } from '@/lib/types'

/**
 * One place per reminder kind: what the notification says, what the alert
 * screen explains, and which routine its button opens. The notification copy
 * and the screen the tap lands on used to be written in two files and could
 * drift apart (§8.4).
 */

export interface KindMeta {
  /** Notification title. */
  title: string
  /** Notification body. */
  body: string
  /** The one line the alert screen gives for doing this rather than ignoring it. */
  why: string
  /** Routine opened by the alert screen. */
  routineSlug: string
}

export const KINDS: Record<ReminderKind, KindMeta> = {
  stand: {
    title: 'Debout.',
    body: '3 minutes. Marche, et regarde par la fenêtre.',
    why: 'Une minute de marche toutes les trente minutes : le seul protocole testé dose par dose.',
    routineSlug: 'debout',
  },
  mobility: {
    title: 'Pause mobilité.',
    body: 'Trois minutes pour une zone qui coince.',
    why: 'Ce sont les hanches qui se raccourcissent vraiment sur une journée assise.',
    routineSlug: 'hanches',
  },
  eyes: {
    title: 'Les yeux.',
    body: 'Regarde au loin, et cligne franchement.',
    why: 'Le 20-20-20 n’est pas démontré. Cligner franchement, en revanche, soulage l’œil sec.',
    routineSlug: 'yeux',
  },
}

export function isReminderKind(v: string | undefined): v is ReminderKind {
  return v === 'stand' || v === 'eyes' || v === 'mobility'
}

/** Where a tap on the notification body lands (§8.4). */
export function alertRoute(kind: ReminderKind): string {
  return `/alerte/${kind}`
}
