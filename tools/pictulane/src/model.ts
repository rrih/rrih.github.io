export type Photo = { key: string; position: number; url: string; thumb: string; alt?: string }
export type Post = {
  id: string
  author: string
  date?: string
  text?: string
  sensitive?: boolean
  repost?: boolean
  images: Photo[]
}
export type Album = {
  version: 1
  username: string
  userId?: string
  fetchedAt: string
  posts: Post[]
  range: 'end' | 'unavailable'
}
export type Slide = Photo & { id: string; post: Post; total: number }
export type Route = { username?: string; postId?: string; imageKey?: string; invalid?: boolean }
export function username(input: string): string {
  let s = input.trim()
  if (s.length > 256) throw Error('invalid')
  if (s.includes('://')) {
    const u = new URL(s)
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.port ||
      !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(u.hostname) ||
      u.search ||
      u.hash
    )
      throw Error('invalid')
    const m = u.pathname.match(/^\/([\w]{1,15})(?:\/media)?\/?$/)
    if (!m) throw Error('invalid')
    s = m[1]
  }
  s = s.replace(/^@/, '')
  if (
    !/^[a-zA-Z0-9_]{1,15}$/.test(s) ||
    ['home', 'explore', 'search', 'i', 'settings', 'intent', 'login', 'signup'].includes(s.toLowerCase())
  )
    throw Error('invalid')
  return s.toLowerCase()
}
export function imageURL(s: string): boolean {
  try {
    const u = new URL(s)
    return (
      u.protocol === 'https:' &&
      u.hostname === 'pbs.twimg.com' &&
      !u.username &&
      !u.password &&
      !u.port &&
      /^\/media\/[\w.-]+$/.test(u.pathname)
    )
  } catch {
    return false
  }
}
export function flatten(album: Album): Slide[] {
  const seen = new Set<string>()
  return [...album.posts]
    .filter((p) => !p.repost && p.author.toLowerCase() === album.username && /^\d+$/.test(p.id))
    .sort((a, b) => (a.id.length !== b.id.length ? b.id.length - a.id.length : b.id.localeCompare(a.id)))
    .flatMap((post) =>
      [...post.images]
        .sort((a, b) => a.position - b.position)
        .filter((p) => imageURL(p.url) && imageURL(p.thumb))
        .map((p) => ({ ...p, id: `${post.id}:${p.key}`, post, total: post.images.length })),
    )
    .filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
}
export function parseRoute(hash: string): Route {
  const m = hash.match(/^#\/([\w]{1,15})(?:\/status\/(\d{1,30})\/media\/([\w-]{1,80}))?\/?$/)
  if (!hash || hash === '#/' || hash === '#') return {}
  if (!m) return { invalid: true }
  try {
    return { username: username(m[1]), postId: m[2], imageKey: m[3] }
  } catch {
    return { invalid: true }
  }
}
export const routeURL = (account: string, slide?: Slide) =>
  `#/${account}${slide ? `/status/${slide.post.id}/media/${slide.key}` : ''}`
export function postStep(slides: Slide[], index: number, direction: number): number {
  const id = slides[index]?.post.id
  let i = index + direction
  while (i >= 0 && i < slides.length && slides[i].post.id === id) i += direction
  if (i < 0 || i >= slides.length) return index
  while (i > 0 && slides[i - 1].post.id === slides[i].post.id) i--
  return i
}
export function swipe(
  dx: number,
  dy: number,
  ms: number,
  width: number,
  start: number,
  scale: number,
  multi: boolean,
): number {
  return !multi &&
    scale <= 1.01 &&
    start > 24 &&
    start < width - 24 &&
    ms < 900 &&
    Math.abs(dx) > 60 &&
    Math.abs(dx) > Math.abs(dy) * 1.8
    ? dx < 0
      ? 1
      : -1
    : 0
}
