import type { Album, Photo, Post } from '../src/model'
export async function loadAlbum(username: string, signal: AbortSignal): Promise<Album> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, username === 'slow' ? 800 : 30)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
  const photo = (key: string, position: number): Photo => ({
    key,
    position,
    url: `https://pbs.twimg.com/media/PICTULANE_TEST_${key}?format=png&name=large`,
    thumb: `https://pbs.twimg.com/media/PICTULANE_TEST_${key}?format=png&name=small`,
    alt: `Test photo ${key}`,
  })
  const post = (id: string, keys: string[]): Post => ({
    id,
    author: username,
    date: '2026-09-18T00:00:00Z',
    text: `TEST ONLY ${id} ${'Long text. '.repeat(80)}`,
    images: keys.map(photo),
  })
  return {
    version: 1,
    username,
    fetchedAt: new Date().toISOString(),
    range: username === 'limited' ? 'unavailable' : 'end',
    posts:
      username === 'empty'
        ? []
        : [
            post('900000000000000003', ['A1', 'A2', 'A3']),
            post('900000000000000002', ['B1']),
            post('900000000000000001', []),
            post('900000000000000000', ['D1', 'D2']),
          ],
  }
}
