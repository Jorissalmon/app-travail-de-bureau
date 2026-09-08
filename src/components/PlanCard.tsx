import { ArrowRight } from 'lucide-react'
import { FigureBadge } from './FigureBadge'
import { Pill } from './Pill'
import { GOAL_LABEL, PAIN_ZONE_LABEL } from '@/content'
import { durationLabel } from '@/lib/format'
import type { AdaptivePlan } from '@/lib/types'

/**
 * « Le plan du jour » — what the home screen opens on.
 *
 * It says four things and no more: how long, which zones, what kind of session,
 * and the one factual line explaining the composition. No streak, no
 * encouragement, no « prêt ? ». The rationale comes straight from the composer,
 * so the card can never claim a reason the engine did not use.
 */
export function PlanCard({
  plan,
  onStart,
  busy = false,
}: {
  plan: AdaptivePlan
  onStart: () => void
  busy?: boolean
}) {
  const zones = plan.targetZones.map((z) => PAIN_ZONE_LABEL[z] ?? z)
  const strength = plan.blocks.filter((b) => b.type === 'strength').length
  const empty = plan.blocks.length === 0

  return (
    <div className="overflow-hidden" style={{ background: 'var(--surface)', borderRadius: 'var(--r-hero)' }}>
      <div className="flex items-start gap-4 p-5">
        <FigureBadge
          figureKey={plan.blocks[0]?.figureKey ?? 'marche'}
          tone="slate"
          size={72}
          animated
        />
        <div className="min-w-0 flex-1">
          <p className="t-card-eyebrow">Plan du jour</p>
          <h2 className="mt-1 text-[24px] leading-tight font-800" style={{ fontWeight: 800 }}>
            {empty ? 'Rien à proposer' : durationLabel(plan.durationS)}
          </h2>
          {zones.length > 0 && (
            <p className="t-meta mt-1 truncate">{zones.join(' · ')}</p>
          )}
        </div>
      </div>

      {!empty && (
        <div className="flex flex-wrap gap-1.5 px-5">
          <Pill>{GOAL_LABEL[plan.goal]}</Pill>
          <Pill>
            {plan.blocks.length} mouvement{plan.blocks.length > 1 ? 's' : ''}
          </Pill>
          {strength > 0 && (
            <Pill variant="accent">
              {strength} renfort{strength > 1 ? 's' : ''}
            </Pill>
          )}
        </div>
      )}

      <p className="t-meta px-5 pt-3">{plan.rationale}</p>

      <div className="p-5 pt-4">
        <button
          type="button"
          className="btn btn-accent btn-block"
          onClick={onStart}
          disabled={busy || empty}
        >
          Lancer la séance
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
