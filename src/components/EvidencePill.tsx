import { Pill } from './Pill'
import { EVIDENCE_LABEL } from '@/content'
import type { EvidenceLevel } from '@/lib/types'

const VARIANT = { solide: 'solid', partielle: 'partial', 'non-demontree': 'weak' } as const

export function EvidencePill({ evidence }: { evidence: EvidenceLevel }) {
  return <Pill variant={VARIANT[evidence]}>{EVIDENCE_LABEL[evidence]}</Pill>
}
