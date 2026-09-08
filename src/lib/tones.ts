import type { AccentKey } from './types'

/**
 * A colour per exercise rather than one per routine, so a list of steps reads
 * as a set of distinct things at a glance (§10.4). Derived from the figure key
 * rather than the position, so the same exercise keeps the same colour in every
 * routine it appears in.
 */

/** `slate` is left out: it is the muted tone, used to recede, never to identify. */
const PALETTE: AccentKey[] = [
  'lime',
  'sky',
  'blush',
  'peach',
  'sage',
  'sun',
  'navy',
  'pine',
  'brick',
]

export function stepTone(figureKey: string): AccentKey {
  let hash = 0
  for (let i = 0; i < figureKey.length; i++) {
    hash = (hash * 31 + figureKey.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]!
}
