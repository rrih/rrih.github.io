import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flatten, username, imageURL, parseRoute, postStep, swipe, type Album } from '../src/model'
import { loadAlbum } from './fixture-provider'
import { cachedAlbum, clearHistory, read, write, remember, recent } from '../src/storage'
test('strict normalization and malicious URLs', () => {
  for (const s of ['NASA', '@NASA', 'https://x.com/NASA/media', 'https://twitter.com/NASA/'])
    assert.equal(username(s), 'nasa')
  for (const s of [
    'https://x.com.evil/nasa',
    'https://evil@x.com/nasa',
    'http://x.com/nasa',
    'javascript:alert(1)',
    'https://x.com/nasa/status/12',
    'https://x.com:443/nasa?foo',
    'a'.repeat(257),
  ])
    assert.throws(() => username(s))
  assert.equal(imageURL('https://pbs.twimg.com.evil/media/x'), false)
})
test('flatten, stable string ids, filtering, dedup and post navigation', async () => {
  const a = await loadAlbum('nasa', new AbortController().signal)
  a.posts.push(
    a.posts[0],
    { ...a.posts[0], id: '99', author: 'other' },
    { ...a.posts[0], id: '98', repost: true },
  )
  const s = flatten(a)
  assert.deepEqual(
    s.map((p) => p.key),
    ['A1', 'A2', 'A3', 'B1', 'D1', 'D2'],
  )
  assert.equal(postStep(s, 2, 1), 3)
  assert.equal(postStep(s, 3, -1), 0)
  assert.equal(parseRoute('#/NASA/status/900000000000000003/media/A2').postId, '900000000000000003')
  assert.equal(parseRoute('#/bad/route').invalid, true)
})
test('gesture intent, edges, pinch, diagonal, multitouch', () => {
  assert.equal(swipe(-90, 5, 250, 375, 200, 1, false), 1)
  assert.equal(swipe(90, 5, 250, 375, 100, 1, false), -1)
  for (const args of [
    [-90, 80, 250, 375, 200, 1, false],
    [-90, 0, 250, 375, 200, 2, false],
    [-90, 0, 250, 375, 200, 1, true],
    [-90, 0, 250, 375, 5, 1, false],
    [4, 0, 250, 375, 200, 1, false],
  ] as const)
    assert.equal(swipe(args[0], args[1], args[2], args[3], args[4], args[5], args[6]), 0)
})
test('storage denied/corrupt, namespace and bounded recent', () => {
  const data: Record<string, string> = { 'atlas:sentinel': 'keep', 'other:key': 'keep' }
  const store = {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
      Object.defineProperty(store, k, { value: v, configurable: true, enumerable: true })
    },
    removeItem: (k: string) => {
      delete data[k]
      delete (store as Record<string, unknown>)[k]
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
  store.setItem('pictulane:v1:bad', '{')
  assert.equal(read('bad', 'fallback'), 'fallback')
  for (let i = 0; i < 12; i++) remember(`user${i}`)
  assert.equal(recent().length, 8)
  store.setItem('pictulane:v1:album:x', '{"version":1}')
  assert.equal(cachedAlbum('x'), undefined)
  store.setItem('pictulane:v1:album:x', JSON.stringify({ version:1, username:'x', fetchedAt:new Date().toISOString(), range:'end', posts:[{id:'1',author:'x',text:{bad:true},images:[]}]}))
  assert.equal(cachedAlbum('x'), undefined)
  clearHistory()
  assert.equal(data['atlas:sentinel'], 'keep')
  assert.equal(data['other:key'], 'keep')
  Object.defineProperty(globalThis, 'localStorage', {
    get() {
      throw new DOMException('denied', 'SecurityError')
    },
    configurable: true,
  })
  assert.equal(write('settings', {}), false)
  assert.equal(read('x', 4), 4)
})
test('invalid metadata cannot crash restoration', () => {
  assert.throws(() => flatten({ version: 1, username: 'x', posts: [null] } as unknown as Album))
})
