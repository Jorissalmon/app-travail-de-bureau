/**
 * Minimal semantic-version comparison for the OTA check (§9.3 / §13.3).
 * Handles the "x.y.z" the manifest and version file use; pre-release tags are
 * compared lexically after the numeric core, which is more than enough here.
 */

export interface Semver {
  major: number
  minor: number
  patch: number
  pre: string
}

export function parseSemver(v: string): Semver | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim())
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ?? '',
  }
}

/** -1 if a < b, 0 if equal, 1 if a > b. Unparseable versions sort lowest. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa && !pb) return 0
  if (!pa) return -1
  if (!pb) return 1

  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1

  // A release outranks a pre-release of the same core (1.0.0 > 1.0.0-rc1).
  if (pa.pre === pb.pre) return 0
  if (pa.pre === '') return 1
  if (pb.pre === '') return -1
  return pa.pre < pb.pre ? -1 : 1
}

/** True when `candidate` is strictly newer than `current`. */
export function semverGt(candidate: string, current: string): boolean {
  return compareSemver(candidate, current) > 0
}

/** True when `have` satisfies the manifest's `minNative` floor. */
export function meetsMinimum(have: string, min: string): boolean {
  return compareSemver(have, min) >= 0
}
