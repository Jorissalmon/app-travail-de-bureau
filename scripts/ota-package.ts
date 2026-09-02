/**
 * Packages dist/ into an OTA bundle and rewrites the manifest (§9.4).
 *
 *   pnpm ota:local        # bump patch, build already done, zip + manifest
 *   pnpm ota:local --no-bump
 *
 * Steps 4-6 of §9.4. The zip has index.html at its root (no parent folder), and
 * the manifest carries the sha256 of the zip. OTA_BASE_URL builds the bundle URL.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** Bundles kept in public/ota; older ones are committed weight nothing reads. */
const KEEP_BUNDLES = 5

function bumpPatch(v: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())
  if (!m) throw new Error(`Bad version in ota/version.json: ${v}`)
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`
}

const versionFile = resolve(root, 'ota/version.json')
const current = (JSON.parse(readFileSync(versionFile, 'utf8')) as { version: string }).version
const noBump = process.argv.includes('--no-bump')
const version = noBump ? current : bumpPatch(current)

const dist = resolve(root, 'dist')
if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('dist/index.html not found — run `pnpm build` first.')
  process.exit(1)
}

const outDir = resolve(root, 'public/ota')
mkdirSync(outDir, { recursive: true })
const zipName = `bundle-${version}.zip`
const zipPath = resolve(outDir, zipName)

// Zip the CONTENTS of dist/ (so index.html is at the archive root, §9.2).
// dist/ota holds the bundles Vite copied back out of public/ — zipping those
// in would make every release carry every release before it, doubling in size
// each time. They are served from the deployment, never read from a bundle.
execFileSync('zip', ['-r', '-q', zipPath, '.', '-x', 'ota/*', './ota/*'], { cwd: dist })

const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
const base = (process.env.OTA_BASE_URL || 'https://app-travail-de-bureau.vercel.app').replace(
  /\/$/,
  '',
)

const manifest = {
  version,
  url: `${base}/ota/${zipName}`,
  checksum,
  minNative: '1.0.0',
  notes: process.env.OTA_NOTES ?? `Version ${version}`,
}
writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
if (!noBump) writeFileSync(versionFile, JSON.stringify({ version }, null, 2) + '\n')

// The manifest only ever points at the newest bundle, so every older one sits
// in the repository, in the deployment and in the APK for nothing. A handful
// are kept in case a device is mid-download when the next release lands.
const dropped = readdirSync(outDir)
  .filter((f) => f.startsWith('bundle-') && f.endsWith('.zip'))
  .map((f) => ({ file: f, parts: f.slice('bundle-'.length, -'.zip'.length).split('.').map(Number) }))
  .sort((a, b) => b.parts[0] - a.parts[0] || b.parts[1] - a.parts[1] || b.parts[2] - a.parts[2])
  .slice(KEEP_BUNDLES)
for (const { file } of dropped) unlinkSync(resolve(outDir, file))

console.log(
  `OTA bundle ${zipName} (${checksum.slice(0, 12)}…), manifest updated → ${version}` +
    (dropped.length > 0 ? `, ${dropped.length} older bundle(s) removed` : ''),
)
