import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contentRevision, createContentFingerprint } from '../scripts/seo-fingerprint'

function fixture(run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-seo-content-'))
  try {
    for (const child of ['models', 'previews']) mkdirSync(join(directory, child))
    writeFileSync(join(directory, 'models/6.glb'), 'model A')
    writeFileSync(join(directory, 'previews/6.webp'), 'preview A')
    run(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('SEO content revision', () => {
  test('keeps the date on rebuild and changes it when a model or preview changes at the same URL', () => {
    fixture((directory) => {
      const assets = ['/atlas/models/6.glb', '/atlas/previews/6.webp']
      const original = contentRevision(
        createContentFingerprint(directory)('Charizard', assets),
        undefined,
        '2026-09-06',
      )
      const rebuilt = createContentFingerprint(directory)('Charizard', assets)
      expect(contentRevision(rebuilt, original, '2026-09-07')).toEqual(original)

      writeFileSync(join(directory, 'previews/25.webp'), 'Unrelated image')
      expect(createContentFingerprint(directory)('Charizard', assets)).toBe(original.hash)

      writeFileSync(join(directory, 'models/6.glb'), 'model B')
      const modelUpdate = contentRevision(
        createContentFingerprint(directory)('Charizard', assets),
        original,
        '2026-09-07',
      )
      expect(modelUpdate.hash).not.toBe(original.hash)
      expect(modelUpdate.modified).toBe('2026-09-07')

      writeFileSync(join(directory, 'previews/6.webp'), 'preview B')
      const previewUpdate = contentRevision(
        createContentFingerprint(directory)('Charizard', assets),
        modelUpdate,
        '2026-09-08',
      )
      expect(previewUpdate.hash).not.toBe(modelUpdate.hash)
      expect(previewUpdate.modified).toBe('2026-09-08')
    })
  })

  test('reads each local asset once per build and normalizes URL aliases', () => {
    fixture((directory) => {
      const fingerprint = createContentFingerprint(directory)
      const first = fingerprint('Charizard', ['/models/6.glb', '/atlas/previews/6.webp'])
      rmSync(join(directory, 'models/6.glb'))
      expect(
        fingerprint('Charizard', [
          'https://rrih.github.io/atlas/models/6.glb',
          '/previews/6.webp',
          '/atlas/previews/6.webp',
        ]),
      ).toBe(first)
      expect(() => createContentFingerprint(directory)('Charizard', ['/models/6.glb'])).toThrow()
    })
  })
})
