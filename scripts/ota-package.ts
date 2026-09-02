/**
 * Packages dist/ into an OTA bundle and rewrites the manifest (§9.4).
 *
 *   pnpm ota:local        # bump patch, build already done, zip + manifest
 *   pnpm ota:local --no-bump
 *
 * Steps 4-6 of §9.4. The zip has index.html at its root (no parent folder), and
 * the manifest carries the sha256 of the zip. OTA_BASE_URL builds the bundle URL.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import JSZip from 'jszip'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** Bundles kept in public/ota; older ones are committed weight nothing reads. */
const KEEP_BUNDLES = 5

/**
 * Vite copies public/ into dist/, so dist/ota holds every bundle already
 * released. Packing those in made each bundle carry all its predecessors,
 * doubling in size every time. They are served from the deployment, never read
 * out of another bundle.
 */
const EXCLUDED_DIRS = new Set(['ota'])

/** Every file under `dir`, as archive paths relative to it, POSIX separators. */
function collect(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (prefix === '' && entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...collect(join(dir, entry.name), rel))
    else out.push(rel)
  }
  return out
}

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

// The CONTENTS of dist/, so index.html sits at the archive root (§9.2).
// Written with JSZip rather than the `zip` binary: that binary does not exist
// on a stock Windows install, so `pnpm ota:local` could not run on the machine
// the app is developed on, and the release step could only ever be exercised in
// CI. Nothing here needs a shell.
const zip = new JSZip()
const entries = collect(dist).sort()

// Sorted, one fixed date, and no directory entries — JSZip would stamp those
// with the build time, which is the one thing that would make two runs over the
// same dist/ differ. Deterministic bytes mean the checksum says whether the
// bundle actually changed, not when it was built. Unzippers create the
// directories they need from the file paths.
const EPOCH = new Date(Date.UTC(1980, 0, 1))
for (const entry of entries) {
  zip.file(entry, readFileSync(join(dist, entry)), { date: EPOCH, createFolders: false })
}
writeFileSync(
  zipPath,
  await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  }),
)

// Read back what was actually written, and refuse to publish it unless it holds.
// These are the invariants that broke once, checked on the artefact itself
// rather than on the list that produced it, and here rather than only in CI —
// `pnpm ota:local` must fail the same way the release workflow does.
const bytes = readFileSync(zipPath)
const written = await JSZip.loadAsync(bytes)
const names = Object.keys(written.files).filter((n) => !written.files[n].dir)

const nested = names.filter((n) => n.startsWith('ota/'))
if (nested.length > 0) {
  throw new Error(
    `Bundle carries past releases (${nested.length}): ${nested.slice(0, 3).join(', ')}`,
  )
}
if (!names.includes('index.html')) {
  throw new Error('Bundle has no index.html at its root — the webview would load nothing.')
}
// Generous — the app is around 200 kB — but far under the 98 MB the nesting bug
// reached, so a comparable mistake stops the release instead of shipping.
const MAX_BUNDLE_BYTES = 20 * 1024 * 1024
if (bytes.byteLength > MAX_BUNDLE_BYTES) {
  throw new Error(`Bundle is ${bytes.byteLength} bytes, over the ${MAX_BUNDLE_BYTES} cap.`)
}

const checksum = createHash('sha256').update(bytes).digest('hex')
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
