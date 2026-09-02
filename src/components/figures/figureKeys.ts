/** Every figure key used by routine steps (§12.2). Kept separate from the
    drawings so the (lazily loaded) SVG module is not pulled into the entry
    chunk just to validate a key. */
export const FIGURE_KEYS = [
  'marche',
  'extension-debout',
  'fente',
  'bascule-bassin',
  'chat-vache',
  'inclinaison-laterale',
  'rotation-assise',
  'figure4-assise',
  'ischios',
  'balancement-hanche',
  'menton-rentre',
  'nuque-laterale',
  'nuque-rotation',
  'haussement-epaules',
  'encadrement-porte',
  'omoplates',
  'cercle-bras',
  'ouverture-pectorale',
  'rotation-externe',
  'extension-chaise',
  'tirage-vide',
  'clignement',
  'loin-pres',
  'paumes',
  'respiration',
  'poignet-flexion',
  'poignet-extension',
  'doigts-ecartes',
  'priere-inversee',
  'cheville-cercle',
  'mollet-releve',
  'talon-pointe',
  'nuque-diagonale',
] as const

export type FigureKey = (typeof FIGURE_KEYS)[number]

export function isFigureKey(v: string): v is FigureKey {
  return (FIGURE_KEYS as readonly string[]).includes(v)
}
