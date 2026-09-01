import { describe, expect, it } from 'vitest'
import { QUEUE_CAP, enqueueEvents, removeConfirmed } from './queue'
import type { ReminderEvent } from '@/lib/types'

function ev(clientId: string, action: ReminderEvent['action'] = 'done'): ReminderEvent {
  return {
    clientId,
    sessionId: 's1',
    kind: 'stand',
    firedAt: '2026-09-01T09:30:00.000Z',
    action,
    actedAt: '2026-09-01T09:31:00.000Z',
    localDate: '2026-09-01',
  }
}

describe('enqueueEvents', () => {
  it('appends new events', () => {
    const q = enqueueEvents([ev('a')], [ev('b'), ev('c')])
    expect(q.map((e) => e.clientId)).toEqual(['a', 'b', 'c'])
  })

  it('does not duplicate an already-queued clientId', () => {
    const q = enqueueEvents([ev('a')], [ev('a')])
    expect(q).toHaveLength(1)
  })

  it('replaces in place with the later action for the same clientId', () => {
    const q = enqueueEvents([ev('a', 'expired')], [ev('a', 'done')])
    expect(q).toHaveLength(1)
    expect(q[0]!.action).toBe('done')
  })

  it('dedups within a single incoming batch too', () => {
    const q = enqueueEvents([], [ev('x'), ev('x')])
    expect(q).toHaveLength(1)
  })

  it('caps at QUEUE_CAP, dropping the oldest', () => {
    const start: ReminderEvent[] = Array.from({ length: QUEUE_CAP }, (_, i) => ev(`old-${i}`))
    const q = enqueueEvents(start, [ev('new')])
    expect(q).toHaveLength(QUEUE_CAP)
    expect(q.at(-1)!.clientId).toBe('new')
    expect(q.some((e) => e.clientId === 'old-0')).toBe(false)
  })
})

describe('removeConfirmed', () => {
  it('drops confirmed ids and keeps the rest', () => {
    const q = removeConfirmed([ev('a'), ev('b'), ev('c')], ['a', 'c'])
    expect(q.map((e) => e.clientId)).toEqual(['b'])
  })

  it('is a no-op when nothing matches', () => {
    const q = removeConfirmed([ev('a')], ['z'])
    expect(q).toHaveLength(1)
  })
})
