import { flatten, imageURL, username, type Album } from './model'
const prefix = 'pictulane:v1:'
const LIMIT = 600_000
export function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(prefix + key)
    return s && s.length <= LIMIT ? JSON.parse(s) : fallback
  } catch {
    return fallback
  }
}
export function write(key: string, value: unknown): boolean {
  try {
    const s = JSON.stringify(value)
    if (s.length > LIMIT) return false
    localStorage.setItem(prefix + key, s)
    return true
  } catch {
    return false
  }
}
export function recent(): string[] {
  const r = read<unknown>('recent', [])
  return Array.isArray(r)
    ? r
        .filter((v): v is string => {
          try {
            return typeof v === 'string' && username(v) === v
          } catch {
            return false
          }
        })
        .slice(0, 8)
    : []
}
export function remember(account: string) {
  const list = [account, ...recent().filter((x) => x !== account)].slice(0, 8)
  const removed = recent().filter((x) => !list.includes(x))
  removed.forEach((a) => {
    remove(`album:${a}`)
    remove(`resume:${a}`)
  })
  write('recent', list)
}
export function remove(key: string) {
  try {
    localStorage.removeItem(prefix + key)
  } catch {
    /* Storage may be denied. */
  }
}
export function saveAlbum(album: Album) {
  remember(album.username)
  const bounded = { ...album, posts: album.posts.slice(0, 300) }
  if (JSON.stringify(bounded).length > 60_000) return false
  return write(`album:${album.username}`, bounded)
}
export function cachedAlbum(account: string): Album | undefined {
  const a = read<Album | undefined>(`album:${account}`, undefined)
  try {
    if (
      a?.version === 1 &&
      a.username === account &&
      Array.isArray(a.posts) && a.posts.length <= 300 &&
      a.posts.every(p => typeof p?.id === 'string' && /^\d{1,30}$/.test(p.id) &&
        typeof p.author === 'string' && username(p.author) === p.author &&
        (p.text === undefined || typeof p.text === 'string') &&
        (p.date === undefined || typeof p.date === 'string' && Number.isFinite(Date.parse(p.date))) &&
        (p.sensitive === undefined || typeof p.sensitive === 'boolean') &&
        (p.repost === undefined || typeof p.repost === 'boolean') &&
        Array.isArray(p.images) && p.images.length <= 20 && p.images.every(i =>
          typeof i?.key === 'string' && /^[\w-]{1,80}$/.test(i.key) &&
          Number.isInteger(i.position) && i.position >= 0 && i.position < 20 &&
          typeof i.url === 'string' && imageURL(i.url) && typeof i.thumb === 'string' && imageURL(i.thumb) &&
          (i.alt === undefined || typeof i.alt === 'string'))) &&
      Number.isFinite(Date.parse(a.fetchedAt)) &&
      ['end', 'unavailable'].includes(a.range)
    ) {
      flatten(a)
      return a
    }
  } catch {
    /* Ignore corrupt metadata. */
  }
  return undefined
}
export function clearHistory() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (
        key.startsWith(prefix + 'album:') ||
        key.startsWith(prefix + 'resume:') ||
        key === prefix + 'recent'
      )
        localStorage.removeItem(key)
    }
  } catch {
    /* Do not disrupt viewing. */
  }
}
export function resume(account: string): string | undefined {
  const v = read<unknown>(`resume:${account}`, undefined)
  return typeof v === 'string' && /^\d{1,30}:[\w-]{1,80}$/.test(v) ? v : undefined
}
