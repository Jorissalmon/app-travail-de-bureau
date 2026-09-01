import { describe, expect, it } from 'vitest'
import {
  LOW_ADHERENCE,
  STREAK_THRESHOLD,
  computeAdherence,
  computeStreak,
  fillDays,
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

  it('breaks on a gap day', () => {
    const days = [day('2026-08-29', 5), day('2026-08-31', 4), day('2026-09-01', 4)]
    // 2026-08-30 is missing (0 stands), so the streak is only today + yesterday.
    expect(computeStreak(days, today)).toBe(2)
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
