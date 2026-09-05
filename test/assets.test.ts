import { expect, test } from 'bun:test'
import { verifyLocalModels } from '../scripts/verify-assets'

test('every bundled GLB is complete and uses embedded textures and valid animation targets', () => {
  const result = verifyLocalModels()
  expect(result.count).toBe(1025)
  expect(result.bytes).toBeGreaterThan(1_000_000)
})
