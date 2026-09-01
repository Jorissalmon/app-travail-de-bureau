import { describe, expect, it } from 'vitest'
import { compareSemver, meetsMinimum, parseSemver, semverGt } from './semver'

describe('parseSemver', () => {
  it('parses a plain version', () => {
    expect(parseSemver('1.4.0')).toEqual({ major: 1, minor: 4, patch: 0, pre: '' })
  })
  it('tolerates a leading v and a pre-release', () => {
    expect(parseSemver('v2.0.1-rc2')).toEqual({ major: 2, minor: 0, patch: 1, pre: 'rc2' })
  })
  it('rejects garbage', () => {
    expect(parseSemver('nope')).toBeNull()
    expect(parseSemver('1.2')).toBeNull()
  })
})

describe('compareSemver / semverGt', () => {
  it('orders by major, minor, patch', () => {
    expect(compareSemver('1.4.0', '1.3.9')).toBe(1)
    expect(compareSemver('1.4.0', '2.0.0')).toBe(-1)
    expect(compareSemver('1.4.1', '1.4.1')).toBe(0)
  })
  it('treats a release as newer than its pre-release', () => {
    expect(semverGt('1.0.0', '1.0.0-rc1')).toBe(true)
    expect(semverGt('1.0.0-rc1', '1.0.0')).toBe(false)
  })
  it('drives the update decision', () => {
    expect(semverGt('1.4.0', '1.3.0')).toBe(true)
    expect(semverGt('1.3.0', '1.3.0')).toBe(false)
    expect(semverGt('1.2.0', '1.3.0')).toBe(false)
  })
  it('sorts unparseable versions lowest', () => {
    expect(semverGt('1.0.0', 'garbage')).toBe(true)
  })
})

describe('meetsMinimum', () => {
  it('passes when native meets or exceeds the floor', () => {
    expect(meetsMinimum('1.0.0', '1.0.0')).toBe(true)
    expect(meetsMinimum('1.2.0', '1.0.0')).toBe(true)
  })
  it('fails when native is below the floor', () => {
    expect(meetsMinimum('1.0.0', '1.1.0')).toBe(false)
  })
})
