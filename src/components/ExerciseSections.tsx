import { Pill } from './Pill'
import type { Exercise } from '@/lib/types'

/**
 * The body of an exercise's explanation: instructions, tips, an easier
 * version, what it works, what means stop. Shared between the full-screen
 * detail page (reached from a routine) and the sheet Player opens mid-exercise
 * (§ audit) — the content is identical, only the frame around it differs.
 */
export function ExerciseSections({ exercise }: { exercise: Exercise }) {
  return (
    <>
      <section>
        <h2 className="t-section mb-3">Instructions</h2>
        <ol className="flex flex-col gap-3">
          {exercise.steps.map((line, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="num flex shrink-0 items-center justify-center rounded-full text-[13px]"
                style={{
                  width: 24,
                  height: 24,
                  background: 'var(--surface-2)',
                  color: 'var(--text-2)',
                }}
              >
                {i + 1}
              </span>
              <p className="t-body pt-0.5">{line}</p>
            </li>
          ))}
        </ol>
      </section>

      {exercise.tips.length > 0 && (
        <section className="mt-7">
          <h2 className="t-section mb-3">Astuces</h2>
          <ul className="flex flex-col gap-2.5">
            {exercise.tips.map((tip, i) => (
              <li
                key={i}
                className="rounded-[16px] p-3 t-body"
                style={{ background: 'var(--surface)', color: 'var(--text-2)' }}
              >
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <h2 className="t-section mb-3">Pour y aller plus doucement</h2>
        <p className="t-body" style={{ color: 'var(--text-2)' }}>
          {exercise.easier}
        </p>
      </section>

      <section className="mt-7">
        <h2 className="t-section mb-3">Ça travaille</h2>
        <div className="flex flex-wrap gap-2">
          {exercise.muscles.map((m) => (
            <Pill key={m}>{m}</Pill>
          ))}
        </div>
      </section>

      <section className="mt-7 rounded-[16px] p-4" style={{ background: 'var(--surface)' }}>
        <h2 className="t-section mb-2" style={{ color: 'var(--danger)' }}>
          À éviter
        </h2>
        <p className="t-body" style={{ color: 'var(--text-2)' }}>
          {exercise.avoid}
        </p>
      </section>
    </>
  )
}
