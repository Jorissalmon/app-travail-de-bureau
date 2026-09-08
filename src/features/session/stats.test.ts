import { describe, expect, it } from 'vitest'
import {
  FREEZES_PER_MONTH,
  LOW_ADHERENCE,
  STREAK_THRESHOLD,
  computeAdherence,
  computeStreak,
  fillDays,
  freezesLeft,
  type DayCount,
} from './stats'

const today = '2026-09-01'

function day(localDate: string, stands: number, reminders = stands): DayCount {
  return { localDate, stands, reminders }
}

describe('computeStreak', () => {
  it('counts consecutive qualifying days ending today', () => {
    const days = [day('2026-08-30', 4), day('2026-08-31', 3), day('2026-09-01', 5)]
    expect(computeStreak(days, today)).toBe(3)
  })

  it('does not break the streak when today is still in progress', () => {
    // Today has only 1 stand so far, but yesterday and before qualify.
    const days = [day('2026-08-30', 4), day('2026-08-31', 3), day('2026-09-01', 1)]
    expect(computeStreak(days, today)).toBe(2)
  })

  it('forgives one gap day, without counting it', () => {
    const days = [day('2026-08-29', 5), day('2026-08-31', 4), day('2026-09-01', 4)]
    // 2026-08-30 is missing. The run survives it, and the number is still the
    // three days actually moved — never four.
    expect(computeStreak(days, today)).toBe(3)
  })

  it('forgives a second gap in the same month, and breaks on the third', () => {
    // § pivot — the budget is two freezes per calendar month, not one per run.
    const two = [day('2026-08-28', 5), day('2026-08-31', 4), day('2026-09-01', 4)]
    // 08-29 and 08-30 are both missing, both in August: both forgiven, and
    // neither is counted — the number is still the three days actually moved.
    expect(computeStreak(two, today)).toBe(3)

    const three = [day('2026-08-27', 5), day('2026-08-31', 4), day('2026-09-01', 4)]
    // 08-28, 08-29 and 08-30 are missing. The budget covers two of them; the
    // third ends the run.
    expect(computeStreak(three, today)).toBe(2)
  })

  it('gives each calendar month its own budget', () => {
    // Two gaps in September and two in August: four forgiven days, one run,
    // because the budget does not carry across the month boundary.
    const days = [
      day('2026-08-30', 4),
      day('2026-08-31', 4),
      day('2026-09-01', 4),
      day('2026-09-04', 4),
    ]
    // Walking back from 09-04: 09-03 and 09-02 are blank and spend the
    // September budget, 08-29 and 08-28 are blank and spend the August one.
    // Four forgiven days inside a single run, and none of them counted.
    expect(computeStreak(days, '2026-09-04')).toBe(4)
  })

  it('respects a budget of zero, which is no forgiveness at all', () => {
    const days = [day('2026-08-29', 5), day('2026-08-31', 4), day('2026-09-01', 4)]
    expect(computeStreak(days, today, { freezesPerMonth: 0 })).toBe(2)
  })

  it('does not forgive a gap that would start the run', () => {
    const days = [day('2026-08-29', 5), day('2026-08-30', 5), day('2026-09-01', 1)]
    // Today is still in progress, so counting starts at 08-31 — which is blank.
    // Forgiving it would mean a streak that begins on a day nothing happened.
    expect(computeStreak(days, today)).toBe(0)
  })

  it('turns forgiveness off on demand', () => {
    const days = [day('2026-08-29', 5), day('2026-08-31', 4), day('2026-09-01', 4)]
    expect(computeStreak(days, today, { grace: false })).toBe(2)
  })

  it('skips the days the user does not work', () => {
    // Two full working weeks, both weekends blank.
    const days = [
      day('2026-08-20', 4), // jeudi
      day('2026-08-21', 4), // vendredi
      day('2026-08-24', 4), // lundi
      day('2026-08-25', 4), // mardi
      day('2026-08-26', 4), // mercredi
      day('2026-08-27', 4), // jeudi
      day('2026-08-28', 4), // vendredi
      day('2026-08-31', 4), // lundi
      day('2026-09-01', 4), // mardi
    ]
    const weekdays = [1, 2, 3, 4, 5]
    // Without this the weekends reset the run every single week, and a
    // Monday-to-Friday user could never see a number above five.
    expect(computeStreak(days, today, { weekdays })).toBe(9)
    // Counting weekends as working days, the first blank weekend (08-29 and
    // 08-30) spends the whole August budget, and the next one ends the run.
    expect(computeStreak(days, today, { weekdays: [] })).toBe(7)
  })

  it('a weekend nobody worked is not a missed day', () => {
    const days = [day('2026-08-31', 4), day('2026-09-01', 4)]
    // 08-28 and 08-27 are blank working days and eat the August budget; the
    // weekend in between costs nothing, and the run is the two days moved.
    expect(computeStreak(days, today, { weekdays: [1, 2, 3, 4, 5] })).toBe(2)
  })

  it('is zero when yesterday failed and today has not qualified', () => {
    const days = [day('2026-08-31', 1), day('2026-09-01', 2)]
    expect(computeStreak(days, today)).toBe(0)
  })

  it('needs at least the threshold', () => {
    const days = [day('2026-09-01', STREAK_THRESHOLD - 1)]
    expect(computeStreak(days, today)).toBe(0)
    const days2 = [day('2026-09-01', STREAK_THRESHOLD)]
    expect(computeStreak(days2, today)).toBe(1)
  })

  it('handles an empty history', () => {
    expect(computeStreak([], today)).toBe(0)
  })
})

describe('freezesLeft', () => {
  it('is the whole budget when nothing has been missed this month', () => {
    const days = [day('2026-09-01', 4), day('2026-09-02', 4), day('2026-09-03', 4)]
    expect(freezesLeft(days, '2026-09-03', { weekdays: [1, 2, 3, 4, 5] })).toBe(FREEZES_PER_MONTH)
  })

  it('counts a missed working day against it', () => {
    // 09-02 is blank, 09-01 and 09-03 are not. Today is still in progress.
    const days = [day('2026-09-01', 4), day('2026-09-03', 4)]
    expect(freezesLeft(days, '2026-09-03', { weekdays: [1, 2, 3, 4, 5] })).toBe(1)
  })

  it('does not count today, which is not over', () => {
    const days = [day('2026-09-01', 4), day('2026-09-02', 4)]
    expect(freezesLeft(days, '2026-09-03', { weekdays: [1, 2, 3, 4, 5] })).toBe(FREEZES_PER_MONTH)
  })

  it('never goes below zero, however bad the month was', () => {
    expect(freezesLeft([], '2026-09-30', { weekdays: [1, 2, 3, 4, 5] })).toBe(0)
  })

  it('looks no further back than the first of the month', () => {
    // Every August day is blank, and none of them counts against September.
    const days = [day('2026-09-01', 4), day('2026-09-02', 4)]
    expect(freezesLeft(days, '2026-09-02', { weekdays: [1, 2, 3, 4, 5] })).toBe(FREEZES_PER_MONTH)
  })
})

describe('computeAdherence', () => {
  it('is null with no events, so the UI can show a dash', () => {
    expect(computeAdherence([])).toBeNull()
  })

  it('counts done and snoozed as acted on', () => {
    const events = [
      { action: 'done' as const },
      { action: 'snoozed' as const },
      { action: 'expired' as const },
      { action: 'dismissed' as const },
    ]
    expect(computeAdherence(events)).toBe(0.5)
  })

  it('flags a low rate under the 40 % threshold', () => {
    const events = [
      { action: 'done' as const },
      { action: 'expired' as const },
      { action: 'expired' as const },
    ]
    const a = computeAdherence(events)!
    expect(a).toBeLessThan(LOW_ADHERENCE)
  })
})

describe('fillDays', () => {
  it('produces one bar per day with zero-filled gaps', () => {
    const series = fillDays([day('2026-09-01', 4)], today, 7)
    expect(series).toHaveLength(7)
    expect(series[0]!.localDate).toBe('2026-08-26')
    expect(series[6]!.localDate).toBe('2026-09-01')
    expect(series[6]!.stands).toBe(4)
    expect(series[0]!.stands).toBe(0)
  })

  it('is ordered oldest to newest', () => {
    const series = fillDays([], today, 7)
    const dates = series.map((d) => d.localDate)
    expect([...dates].sort()).toEqual(dates)
  })
})
