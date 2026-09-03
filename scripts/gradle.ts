/**
 * Runs the Gradle wrapper from the android/ project, with whichever name the
 * platform uses. The npm script used to be `cd android && ./gradlew …`, which
 * cmd.exe cannot resolve — and pointing pnpm's script-shell at bash to work
 * around it broke every other script on any shell that has no bash on PATH,
 * `pnpm dev` included. Spawning it here needs no shell at all.
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const android = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'android')
const onWindows = process.platform === 'win32'
const args = process.argv.slice(2)

// A .bat is not an executable image, so Windows needs an interpreter for it.
// Naming cmd.exe outright rather than passing `shell: true` keeps the arguments
// as arguments — the shell option concatenates them into a command line, which
// Node deprecated for exactly that reason.
const [command, commandArgs] = onWindows
  ? ['cmd.exe', ['/d', '/s', '/c', resolve(android, 'gradlew.bat'), ...args]]
  : [resolve(android, 'gradlew'), args]

execFileSync(command, commandArgs, { cwd: android, stdio: 'inherit' })
