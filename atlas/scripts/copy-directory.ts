import { execFileSync } from 'node:child_process'
import { constants, cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Preserve independent outputs while avoiding duplicate asset storage where supported. */
export function copyDirectory(source: string | URL, destination: string | URL) {
  const from = typeof source === 'string' ? source : fileURLToPath(source)
  const to = typeof destination === 'string' ? destination : fileURLToPath(destination)
  mkdirSync(to, { recursive: true })
  if (process.platform === 'darwin') {
    // Node's FICLONE flag can fall back to full copies on macOS; native cp uses clonefile.
    execFileSync('/bin/cp', ['-cR', `${join(from)}/.`, to])
  } else {
    cpSync(from, to, { recursive: true, mode: constants.COPYFILE_FICLONE })
  }
}
