import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SITE_ORIGIN } from '../src/routes'

export interface ContentRevision {
  hash: string
  modified: string
}

// One build reads each asset once, even when all nine languages reference it.
export function createContentFingerprint(publicDirectory: string) {
  const assetHashes = new Map<string, string>()
  return (content: string, assetPaths: string[] = []) => {
    const files = [
      ...new Set(
        assetPaths.map((path) => {
          const url = new URL(path, SITE_ORIGIN)
          if (url.origin !== SITE_ORIGIN) throw new Error(`Nonlocal SEO asset: ${path}`)
          return resolve(publicDirectory, url.pathname.replace(/^\/atlas\//, '/').replace(/^\/+/, ''))
        }),
      ),
    ].sort()
    const assets = files.map((file) => {
      let hash = assetHashes.get(file)
      if (!hash) {
        hash = createHash('sha256').update(readFileSync(file)).digest('hex')
        assetHashes.set(file, hash)
      }
      return hash
    })
    return createHash('sha256')
      .update(JSON.stringify([content, assets]))
      .digest('hex')
  }
}

export const contentRevision = (
  hash: string,
  previous: ContentRevision | undefined,
  today: string,
): ContentRevision => ({ hash, modified: previous?.hash === hash ? previous.modified : today })
