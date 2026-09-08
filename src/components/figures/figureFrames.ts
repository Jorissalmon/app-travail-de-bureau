import type { FigureKey } from './figureKeys'

/**
 * Exercises that are a movement between two positions rather than a hold. One
 * drawing shows half of those, so they get a second frame and the badge
 * alternates between the two — the loop is the demonstration.
 *
 * Everything else keeps a single figure with its own motion loop; adding a
 * frame where none is needed would only make the badge flicker.
 */
const FRAMES: Partial<Record<FigureKey, FigureKey>> = {
  'chat-vache': 'chat-vache-b',
  omoplates: 'omoplates-b',
  'doigts-ecartes': 'doigts-poing',
  'mollet-releve': 'mollet-plat',
}

/** The second position of an exercise, or null when one drawing is enough. */
export function secondFrame(figureKey: string): FigureKey | null {
  return FRAMES[figureKey as FigureKey] ?? null
}
