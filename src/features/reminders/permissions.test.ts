import { describe, expect, it, vi } from 'vitest'

// Off Android nothing may block: the browser used for development has no
// notification channel, no exact alarms and no battery optimisation.
vi.mock('@/lib/platform', () => ({
  isNative: () => false,
  platform: () => 'web',
}))

import {
  PERMISSION_ORDER,
  type PermissionState,
  allGranted,
  missing,
  readPermissions,
  requestPermission,
} from './permissions'

const none: PermissionState = { notifications: false, exactAlarms: false, battery: false }
const all: PermissionState = { notifications: true, exactAlarms: true, battery: true }

describe('allGranted / missing', () => {
  it('needs every entry', () => {
    expect(allGranted(all)).toBe(true)
    expect(allGranted({ ...all, battery: false })).toBe(false)
    expect(allGranted(none)).toBe(false)
  })

  it('lists what is left, in the order the sheet shows them', () => {
    expect(missing(all)).toEqual([])
    expect(missing({ ...all, exactAlarms: false })).toEqual(['exactAlarms'])
    expect(missing(none)).toEqual(PERMISSION_ORDER)
  })
})

describe('off Android', () => {
  it('reads as fully granted', async () => {
    expect(await readPermissions()).toEqual(all)
  })

  it('grants without touching a plugin', async () => {
    expect(await requestPermission('notifications')).toEqual(all)
    expect(await requestPermission('battery')).toEqual(all)
  })
})
