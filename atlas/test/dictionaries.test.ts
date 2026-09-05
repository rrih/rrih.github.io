import { expect, test } from 'bun:test'
import { createDictionaryLoader } from '../src/dictionaries'

const japanese = { 'Choose your language': '言語を選択', Explore: '見る' }

test('only the requested language is fetched, concurrent loads share a request, and reuse is local', async () => {
  const calls: string[] = []
  let respond: (response: Response) => void = () => {}
  const loader = createDictionaryLoader(async (url) => {
    calls.push(url)
    return new Promise((resolve) => {
      respond = resolve
    })
  })
  expect((await loader.load('en')).Explore).toBe('Explore')
  expect(calls).toEqual([])
  const first = loader.load('ja')
  const second = loader.load('ja')
  expect(first).toBe(second)
  expect(calls).toEqual(['/atlas/locales/ui/ja.json'])
  respond(Response.json(japanese))
  expect(await first).toEqual(japanese)
  expect(await loader.load('ja')).toEqual(japanese)
  expect(calls).toHaveLength(1)
})

test('failed or malformed language downloads remain retryable and do not poison the cache', async () => {
  let attempt = 0
  const loader = createDictionaryLoader(async () => {
    attempt++
    if (attempt === 1) throw new TypeError('Network unavailable')
    if (attempt === 2) return new Response('', { status: 503 })
    if (attempt === 3) return Response.json([])
    return Response.json(japanese)
  })
  for (let index = 0; index < 3; index++) {
    await expect(loader.load('ja')).rejects.toThrow()
    expect(loader.get('ja')).toBeUndefined()
  }
  expect(await loader.load('ja')).toEqual(japanese)
  expect(attempt).toBe(4)
})
