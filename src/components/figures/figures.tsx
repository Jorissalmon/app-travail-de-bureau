import type { JSX } from 'react'
import type { FigureKey } from './figureKeys'

/**
 * Flat two-tone figures, drawn by hand for this app (§10 — no asset is taken
 * from any existing application).
 *
 * Shared vocabulary, so 25 drawings read as one family:
 *  - 100x100 viewBox, everything inherits `currentColor`
 *  - a rounded "ground" bar at the bottom, at low opacity
 *  - limbs as 6.5px round-capped strokes, head as a filled circle
 *  - no facial detail
 */

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 6.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const THIN = { ...S, strokeWidth: 4.5 } as const
const HAIR = { ...S, strokeWidth: 3.5, opacity: 0.55 } as const

/** The floor or mat every standing figure rests on. */
function Ground({ y = 82, x = 16, w = 68 }: { y?: number; x?: number; w?: number }) {
  return <rect x={x} y={y} width={w} height={8} rx={4} fill="currentColor" opacity={0.25} />
}

/** A chair seen from the side, for the seated figures. */
function Chair() {
  return (
    <g opacity={0.25}>
      <rect x={30} y={56} width={40} height={7} rx={3.5} fill="currentColor" />
      <rect x={62} y={26} width={7} height={34} rx={3.5} fill="currentColor" />
      <rect x={34} y={62} width={6} height={22} rx={3} fill="currentColor" />
      <rect x={60} y={62} width={6} height={22} rx={3} fill="currentColor" />
    </g>
  )
}

function Head({ cx, cy, r = 7.5 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" />
}

const figures: Record<FigureKey, () => JSX.Element> = {
  // ---- General / lower body -------------------------------------------------

  marche: () => (
    <g>
      <Ground />
      <Head cx={48} cy={19} />
      <path {...S} d="M48 28 L48 52" />
      <path {...S} d="M48 52 L38 82" />
      <path {...S} d="M48 52 L61 68 L58 82" />
      <path {...S} d="M48 34 L36 44" />
      <path {...S} d="M48 34 L61 42" />
      <path {...HAIR} d="M22 30 L30 30 M18 40 L28 40" />
    </g>
  ),

  'extension-debout': () => (
    <g>
      <Ground />
      <Head cx={54} cy={20} />
      <path {...S} d="M52 29 C48 40 44 46 44 56" />
      <path {...S} d="M44 56 L41 82" />
      <path {...S} d="M44 56 L50 82" />
      <path {...S} d="M50 34 C40 36 34 44 38 52" />
      <path {...HAIR} d="M62 16 C70 20 72 28 70 34" />
    </g>
  ),

  fente: () => (
    <g>
      <Ground />
      <Head cx={44} cy={22} />
      <path {...S} d="M44 31 L44 54" />
      <path {...S} d="M44 54 L30 66 L30 82" />
      <path {...S} d="M44 54 L66 74 L76 82" />
      <path {...S} d="M44 38 L34 48" />
      <path {...S} d="M44 38 L55 46" />
    </g>
  ),

  'bascule-bassin': () => (
    <g>
      <Ground />
      <Head cx={48} cy={19} />
      <path {...S} d="M48 28 L48 54" />
      <path {...S} d="M48 54 L41 82" />
      <path {...S} d="M48 54 L56 82" />
      <path {...S} d="M48 36 L38 46" />
      <path {...S} d="M48 36 L58 46" />
      <path {...HAIR} d="M64 50 A12 12 0 0 1 64 62" />
      <path {...HAIR} d="M32 50 A12 12 0 0 0 32 62" />
    </g>
  ),

  'chat-vache': () => (
    <g>
      <Ground />
      <Head cx={30} cy={40} />
      <path {...S} d="M37 42 C50 30 62 36 70 46" />
      <path {...S} d="M70 46 L66 62 L66 82" />
      <path {...S} d="M70 46 L74 62 L76 82" />
      <path {...S} d="M42 44 L40 62" />
      <path {...HAIR} d="M46 24 C56 20 66 24 72 32" />
    </g>
  ),

  'inclinaison-laterale': () => (
    <g>
      <Ground />
      <Head cx={38} cy={24} />
      <path {...S} d="M40 32 C46 42 52 48 54 58" />
      <path {...S} d="M54 58 L50 82" />
      <path {...S} d="M54 58 L60 82" />
      <path {...S} d="M42 34 C34 26 30 20 32 14" />
      <path {...S} d="M50 44 L58 52" />
    </g>
  ),

  'rotation-assise': () => (
    <g>
      <Chair />
      <Ground />
      <Head cx={46} cy={24} />
      <path {...S} d="M46 33 L48 56" />
      <path {...S} d="M48 56 L34 58 L34 76" />
      <path {...S} d="M46 38 L64 34" />
      <path {...S} d="M46 40 L34 46" />
      <path {...HAIR} d="M56 18 A14 14 0 0 1 66 28" />
    </g>
  ),

  'figure4-assise': () => (
    <g>
      <Chair />
      <Ground />
      <Head cx={44} cy={26} />
      <path {...S} d="M45 35 L48 56" />
      <path {...S} d="M48 56 L32 58 L34 76" />
      <path {...S} d="M48 56 L40 44 L26 52" />
      <path {...S} d="M44 38 L36 50" />
    </g>
  ),

  ischios: () => (
    <g>
      <Ground />
      <rect x={16} y={58} width={26} height={7} rx={3.5} fill="currentColor" opacity={0.25} />
      <Head cx={62} cy={26} />
      <path {...S} d="M61 35 C56 44 54 50 56 58" />
      <path {...S} d="M56 58 L58 82" />
      <path {...S} d="M56 58 L26 60" />
      <path {...S} d="M58 38 L38 54" />
    </g>
  ),

  'balancement-hanche': () => (
    <g>
      <Ground />
      <Head cx={50} cy={19} />
      <path {...S} d="M50 28 L50 54" />
      <path {...S} d="M50 54 L48 82" />
      <path {...S} d="M50 54 L66 70" />
      <path {...S} d="M50 36 L38 44" />
      <path {...HAIR} d="M30 74 A24 24 0 0 1 42 60" />
      <path {...HAIR} d="M72 74 A24 24 0 0 0 60 60" />
    </g>
  ),

  // ---- Neck -----------------------------------------------------------------

  'menton-rentre': () => (
    <g>
      <Head cx={54} cy={34} r={13} />
      <path {...S} d="M52 48 L52 64" />
      <path {...S} d="M34 72 L70 72" />
      <path {...THIN} d="M74 34 L60 34" />
      <path {...THIN} d="M66 28 L60 34 L66 40" />
    </g>
  ),

  'nuque-laterale': () => (
    <g>
      <Head cx={40} cy={30} r={12} />
      <path {...S} d="M45 42 C50 50 52 56 52 62" />
      <path {...S} d="M32 72 L72 72" />
      <path {...S} d="M52 62 L52 72" />
      <path {...HAIR} d="M30 16 A20 20 0 0 1 52 16" />
    </g>
  ),

  'nuque-rotation': () => (
    <g>
      <Head cx={52} cy={32} r={12} />
      <path {...S} d="M52 44 L52 62" />
      <path {...S} d="M32 72 L72 72" />
      <path {...HAIR} d="M24 34 A28 20 0 0 1 80 34" />
      <circle cx={24} cy={34} r={3.5} fill="currentColor" opacity={0.55} />
      <circle cx={80} cy={34} r={3.5} fill="currentColor" opacity={0.55} />
    </g>
  ),

  'haussement-epaules': () => (
    <g>
      <Head cx={50} cy={30} r={11} />
      <path {...S} d="M50 42 L50 58" />
      <path {...S} d="M30 52 C34 44 40 44 44 46" />
      <path {...S} d="M70 52 C66 44 60 44 56 46" />
      <path {...S} d="M30 52 L28 70" />
      <path {...S} d="M70 52 L72 70" />
      <path {...THIN} d="M50 16 L50 6 M45 11 L50 5 L55 11" opacity={0.55} />
    </g>
  ),

  'encadrement-porte': () => (
    <g>
      <Ground />
      <rect x={68} y={10} width={9} height={74} rx={4} fill="currentColor" opacity={0.25} />
      <Head cx={44} cy={22} />
      <path {...S} d="M44 31 L44 56" />
      <path {...S} d="M44 56 L38 82" />
      <path {...S} d="M44 56 L54 82" />
      <path {...S} d="M44 36 L60 30 L66 38" />
    </g>
  ),

  // ---- Upper back -----------------------------------------------------------

  omoplates: () => (
    <g>
      <Ground />
      <Head cx={50} cy={20} />
      <path {...S} d="M50 29 L50 58" />
      <path {...S} d="M50 58 L42 82" />
      <path {...S} d="M50 58 L58 82" />
      <path {...S} d="M50 36 L30 34 L26 46" />
      <path {...S} d="M50 36 L70 34 L74 46" />
      <path {...HAIR} d="M40 46 L46 40 M60 46 L54 40" />
    </g>
  ),

  'cercle-bras': () => (
    <g>
      <Ground />
      <Head cx={46} cy={22} />
      <path {...S} d="M46 31 L46 58" />
      <path {...S} d="M46 58 L40 82" />
      <path {...S} d="M46 58 L54 82" />
      <path {...S} d="M46 36 L64 26" />
      <path {...HAIR} d="M70 44 A22 22 0 1 0 50 12" />
    </g>
  ),

  'ouverture-pectorale': () => (
    <g>
      <Ground />
      <Head cx={50} cy={24} />
      <path {...S} d="M50 33 L50 60" />
      <path {...S} d="M50 60 L42 82" />
      <path {...S} d="M50 60 L58 82" />
      <path {...S} d="M42 20 L26 34 L28 46" />
      <path {...S} d="M58 20 L74 34 L72 46" />
    </g>
  ),

  'rotation-externe': () => (
    <g>
      <Ground />
      <Head cx={50} cy={22} />
      <path {...S} d="M50 31 L50 58" />
      <path {...S} d="M50 58 L42 82" />
      <path {...S} d="M50 58 L58 82" />
      <path {...S} d="M42 38 L38 50 L20 46" />
      <path {...S} d="M58 38 L62 50 L80 46" />
    </g>
  ),

  'extension-chaise': () => (
    <g>
      <Chair />
      <Ground />
      <Head cx={54} cy={28} r={8} />
      <path {...S} d="M52 37 C48 44 46 50 48 56" />
      <path {...S} d="M48 56 L30 58 L32 76" />
      <path {...S} d="M46 32 L34 24 L30 34" />
      <path {...HAIR} d="M62 20 C70 26 72 34 70 42" />
    </g>
  ),

  'tirage-vide': () => (
    <g>
      <Ground />
      <Head cx={48} cy={22} />
      <path {...S} d="M48 31 L48 58" />
      <path {...S} d="M48 58 L41 82" />
      <path {...S} d="M48 58 L56 82" />
      <path {...S} d="M48 38 L30 42 L22 34" />
      <path {...S} d="M48 40 L66 44" />
      <path {...THIN} d="M76 44 L88 44 M82 38 L88 44 L82 50" opacity={0.55} />
    </g>
  ),

  // ---- Eyes and breath ------------------------------------------------------

  clignement: () => (
    <g>
      <path {...S} d="M18 52 C34 30 66 30 82 52" />
      <path {...S} d="M18 52 C34 62 66 62 82 52" />
      <path {...HAIR} d="M30 62 L26 72 M50 66 L50 76 M70 62 L74 72" />
    </g>
  ),

  'loin-pres': () => (
    <g>
      <path {...S} d="M14 40 C26 24 46 24 58 40" />
      <path {...S} d="M14 40 C26 56 46 56 58 40" />
      <circle cx={36} cy={40} r={7} fill="currentColor" />
      <path {...S} d="M74 60 L74 78" opacity={0.6} />
      <circle cx={86} cy={30} r={5} fill="currentColor" opacity={0.4} />
      <path {...HAIR} d="M62 44 L82 34" />
    </g>
  ),

  paumes: () => (
    <g>
      <Head cx={50} cy={44} r={22} />
      {/* Cupped palms sit on top of the head shape, so they are punched out
          with the pastille colour rather than drawn in the figure tone. */}
      <path {...S} d="M22 42 C22 30 32 26 38 32 C42 26 50 28 50 38" stroke="var(--pastille)" />
      <path {...S} d="M78 42 C78 30 68 26 62 32 C58 26 50 28 50 38" stroke="var(--pastille)" />
      <path {...S} d="M50 66 L50 80" />
    </g>
  ),

  respiration: () => (
    <g>
      <Head cx={50} cy={24} />
      <path {...S} d="M50 33 L50 58" />
      <path {...S} d="M50 58 L42 80" />
      <path {...S} d="M50 58 L58 80" />
      <path {...S} d="M50 38 L34 46" />
      <path {...S} d="M50 38 L66 46" />
      <path {...HAIR} d="M22 40 A32 32 0 0 1 22 20" />
      <path {...HAIR} d="M78 40 A32 32 0 0 0 78 20" />
    </g>
  ),

  // ---- Wrists and forearms --------------------------------------------------
  // Drawn close up: at badge size a whole body would hide the only thing that
  // matters here, which is the angle of the hand on the forearm.

  'poignet-flexion': () => (
    <g>
      <path {...S} d="M14 40 L54 40" />
      <path {...S} d="M54 40 L60 62" />
      <path {...THIN} d="M60 62 L52 70 M60 62 L62 72 M60 62 L70 68" />
      <path {...HAIR} d="M74 42 C80 52 78 62 70 68" />
      <path {...HAIR} d="M74 34 L74 44 L66 42" />
    </g>
  ),

  'poignet-extension': () => (
    <g>
      <path {...S} d="M14 56 L54 56" />
      <path {...S} d="M54 56 L60 34" />
      <path {...THIN} d="M60 34 L52 26 M60 34 L62 24 M60 34 L70 28" />
      <path {...HAIR} d="M74 54 C80 44 78 34 70 28" />
      <path {...HAIR} d="M74 62 L74 52 L66 54" />
    </g>
  ),

  'doigts-ecartes': () => (
    <g>
      <path {...S} d="M48 84 L48 70" />
      <rect x={35} y={56} width={27} height={15} rx={7.5} fill="currentColor" />
      <path {...THIN} d="M40 56 L30 34" />
      <path {...THIN} d="M46 56 L44 30" />
      <path {...THIN} d="M53 56 L57 31" />
      <path {...THIN} d="M59 58 L70 40" />
      <path {...THIN} d="M37 63 L20 57" />
    </g>
  ),

  'priere-inversee': () => (
    <g>
      <Head cx={50} cy={20} />
      <path {...S} d="M50 29 L50 58" />
      <path {...S} d="M50 36 L30 48 L44 60" />
      <path {...S} d="M50 36 L70 48 L56 60" />
      <path {...THIN} d="M50 58 L50 74" />
      <path {...HAIR} d="M44 62 L44 72 M56 62 L56 72" />
    </g>
  ),

  // ---- Ankles and calves ----------------------------------------------------

  'cheville-cercle': () => (
    <g>
      <path {...S} d="M46 14 L46 48" />
      <path {...S} d="M46 48 L66 54" />
      <path {...HAIR} d="M46 66 m -22 0 a 22 12 0 1 0 44 0 a 22 12 0 1 0 -44 0" />
      <path {...HAIR} d="M62 60 L70 66 L62 72" />
    </g>
  ),

  // Drawn as a lower leg rather than a whole body: at badge size a standing
  // figure on tiptoe is indistinguishable from one walking.
  'mollet-releve': () => (
    <g>
      <Ground />
      <path {...S} d="M50 16 L50 54" />
      <path {...S} d="M50 54 L43 62" />
      <path {...S} d="M43 62 L70 80" />
      <path {...THIN} d="M28 62 L28 44 M22 51 L28 43 L34 51" opacity={0.6} />
    </g>
  ),

  'talon-pointe': () => (
    <g>
      <Ground />
      <path {...S} d="M44 14 L44 50" />
      <path {...S} d="M44 50 L38 64" />
      <path {...S} d="M38 64 L38 80" />
      <path {...S} d="M38 72 L70 60" />
      <path {...THIN} d="M80 52 L86 58 L80 64" opacity={0.6} />
      <path {...THIN} d="M80 84 L86 78 L80 72" opacity={0.6} />
      <path {...HAIR} d="M86 58 L86 78" />
    </g>
  ),

  // ---- Neck, diagonal -------------------------------------------------------

  'nuque-diagonale': () => (
    <g>
      <Head cx={42} cy={36} r={12} />
      <path {...S} d="M48 46 C54 52 56 58 56 64" />
      <path {...S} d="M34 74 L74 74" />
      <path {...S} d="M56 64 L56 74" />
      {/* The hand comes up the far side and lands behind the crown, so the arm
          never crosses the face. */}
      <path {...S} d="M70 72 C78 52 70 30 52 26" />
      <path {...HAIR} d="M28 54 L20 62 M20 54 L20 62 L28 62" />
    </g>
  ),
}

export default figures
