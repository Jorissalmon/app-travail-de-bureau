import { useMemo } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Sheet } from './Sheet'
import { KINDS } from '@/features/reminders/kinds'
import { contextualCopy } from '@/features/reminders/contextual'
import { pendingAfter } from '@/features/reminders/schedule'
import { clockTime } from '@/lib/date'
import type { Occurrence } from '@/features/reminders/schedule'
import type { AdaptivePlan } from '@/lib/types'

/**
 * What is armed, and what each one will open.
 *
 * The reminder grid was the least legible part of the app: one reminder is
 * armed at a time (§8.2), so « prochain rappel dans 12 min » was the only thing
 * anyone could ever see, and nobody could tell whether the mobility slots were
 * still going to fire or what the tap would land on.
 *
 * Now that a reminder can open either the day's plan or the ordinary break,
 * that ambiguity costs something real, so the sheet says it outright: the one
 * that is armed, the fixed mobility slots, and for each of them the routine it
 * opens. Nothing here is a promise — a quiet window or the end of the day can
 * still cancel any of it, and the footnote says so.
 */
export function NextReminders({
  open,
  onClose,
  occurrences,
  mobilityTimes,
  eyeReminders,
  now,
  plan,
  planDoneToday,
  sessionActive,
}: {
  open: boolean
  onClose: () => void
  occurrences: Occurrence[]
  mobilityTimes: string[]
  eyeReminders: boolean
  now: Date
  plan: AdaptivePlan | null
  planDoneToday: boolean
  sessionActive: boolean
}) {
  const armed = useMemo(
    () => pendingAfter(occurrences, now).sort((a, b) => a.at.getTime() - b.at.getTime()),
    [occurrences, now],
  )

  return (
    <Sheet open={open} onClose={onClose} title="Les prochains rappels">
      {!sessionActive ? (
        <div className="flex items-start gap-3">
          <BellOff size={18} color="var(--text-2)" aria-hidden="true" className="mt-0.5" />
          <p className="t-body" style={{ color: 'var(--text-2)' }}>
            Ta journée n’est pas lancée : aucun rappel ne partira. Le plan du jour reste
            disponible, il n’attend pas la session pour être fait.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {armed.length === 0 ? (
            <p className="t-body" style={{ color: 'var(--text-2)' }}>
              Rien d’armé pour l’instant. C’est le cas pendant une plage silencieuse, en pause, ou
              une fois la journée terminée.
            </p>
          ) : (
            armed.map((occ) => {
              const copy = contextualCopy(occ.kind, occ.at, { plan, planDoneToday })
              return (
                <Row
                  key={occ.id}
                  when={clockTime(occ.at.toISOString())}
                  title={copy.title}
                  detail={copy.body}
                />
              )
            })
          )}

          {mobilityTimes.length > 0 && (
            <div>
              <p className="t-section mb-2">Créneaux mobilité</p>
              {mobilityTimes.map((t) => (
                <Row key={t} when={t} title={KINDS.mobility.title} detail={KINDS.mobility.body} />
              ))}
            </div>
          )}

          {eyeReminders && (
            <p className="t-meta">
              Les rappels des yeux tournent aussi, toutes les vingt minutes. Ils ne s’ajoutent pas
              à une pause : celui qui tombe sur un lever est absorbé.
            </p>
          )}
        </div>
      )}

      <p className="t-meta mt-5">
        Un seul rappel est armé à la fois. Une plage silencieuse, un jour non travaillé ou une
        pause peuvent en annuler un : cette liste dit ce qui est prévu, pas ce qui est promis.
      </p>
    </Sheet>
  )
}

function Row({ when, title, detail }: { when: string; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Bell size={18} color="var(--accent)" aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px]" style={{ fontWeight: 700 }}>
          <span className="num">{when}</span> — {title}
        </p>
        <p className="t-meta mt-0.5">{detail}</p>
      </div>
    </div>
  )
}
