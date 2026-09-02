import type { FigureKey } from './figureKeys'

/**
 * The motion a figure gets when it is shown large enough to be a demonstration
 * rather than an icon (alert screen, player). Six loops, picked so the movement
 * says what to do — the eye figure blinks, the far-and-near one pulls focus in
 * and out, the arm circles turn.
 *
 * Kept as class names rather than inline animation so the global
 * prefers-reduced-motion rule in styles/index.css neutralises all of them at
 * once (§10.3).
 */

export type MotionClass =
  | 'fig-bob'
  | 'fig-tilt'
  | 'fig-pulse'
  | 'fig-blink'
  | 'fig-turn'
  | 'fig-breathe'

const MOTION: Partial<Record<FigureKey, MotionClass>> = {
  marche: 'fig-bob',
  'balancement-hanche': 'fig-tilt',
  'bascule-bassin': 'fig-tilt',
  'inclinaison-laterale': 'fig-tilt',
  'nuque-laterale': 'fig-tilt',
  'nuque-rotation': 'fig-tilt',
  'rotation-assise': 'fig-tilt',
  'chat-vache': 'fig-breathe',
  respiration: 'fig-breathe',
  paumes: 'fig-breathe',
  'loin-pres': 'fig-pulse',
  clignement: 'fig-blink',
  'cercle-bras': 'fig-turn',
  'rotation-externe': 'fig-turn',
  omoplates: 'fig-pulse',
  'haussement-epaules': 'fig-bob',
  'menton-rentre': 'fig-bob',
  'tirage-vide': 'fig-pulse',
  'poignet-flexion': 'fig-tilt',
  'poignet-extension': 'fig-tilt',
  'doigts-ecartes': 'fig-pulse',
  'priere-inversee': 'fig-breathe',
  'cheville-cercle': 'fig-turn',
  'mollet-releve': 'fig-bob',
  'talon-pointe': 'fig-tilt',
  'nuque-diagonale': 'fig-tilt',
  'calin-bras': 'fig-pulse',
  'triceps-tete': 'fig-pulse',
  'ischios-assis': 'fig-breathe',
  'genou-poitrine': 'fig-pulse',
  'nuque-flexion': 'fig-bob',
  'poignet-priere': 'fig-bob',
}

/** Falls back to the slow breathing loop: a still figure reads as broken. */
export function motionClass(figureKey: string): MotionClass {
  return MOTION[figureKey as FigureKey] ?? 'fig-breathe'
}
