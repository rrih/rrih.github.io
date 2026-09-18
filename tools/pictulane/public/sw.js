/* Build replaces only these shell constants. Runtime images survive app releases. */
const SHELL = 'pictulane-shell-__BUILD__'
const ASSETS = __ASSETS__
const BASE = '/tools/pictulane/'
const IMAGES = 'pictulane-images-v1',
  META = 'pictulane-image-meta-v1'
const CONFIG = new URL(`${BASE}__cache_settings`, self.location.origin).href
const TTL = 24 * 60 * 60 * 1000
let queue = Promise.resolve()
const serial = (fn) => {
  const result = queue.then(fn)
  queue = result.catch(() => {})
  return result
}
function allowed(raw) {
  try {
    const u = new URL(raw)
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
async function stores() {
  return [await caches.open(IMAGES), await caches.open(META)]
}
async function enabled(meta) {
  const r = await meta.match(CONFIG)
  return !r || (await r.json()).enabled !== false
}
async function prune(images, meta) {
  const now = Date.now(),
    entries = []
  for (const req of await images.keys()) {
    const record = await meta.match(req)
    let m
    try {
      m = record && (await record.json())
    } catch {
      m = null
    }
    if (!m || !Number.isFinite(m.saved) || now - m.saved > TTL) {
      await images.delete(req)
      await meta.delete(req)
    } else entries.push({ req, ...m })
  }
  for (const opaque of [false, true]) {
    const group = entries.filter((e) => e.opaque === opaque).sort((a, b) => b.used - a.used)
    for (const e of group.slice(opaque ? 10 : 100)) {
      await images.delete(e.req)
      await meta.delete(e.req)
    }
  }
  for (const req of await meta.keys()) {
    if (req.url !== CONFIG && !(await images.match(req))) await meta.delete(req)
  }
}
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const c = await caches.open(SHELL)
      await c.addAll(ASSETS)
    })(),
  ),
)
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      // Keep current and most recent previous shell for already-open tabs. Never touch another app.
      const shells = (await caches.keys()).filter((n) => n.startsWith('pictulane-shell-'))
      for (const name of shells.filter((n) => n !== SHELL).slice(0, -1)) await caches.delete(name)
      await self.clients.claim()
    })(),
  ),
)
self.addEventListener('message', (event) =>
  event.waitUntil(
    (async () => {
      const client = event.source
      if (
        !client?.url ||
        new URL(client.url).origin !== self.location.origin ||
        !new URL(client.url).pathname.startsWith(BASE)
      )
        return
      const data = event.data || {}
      if (data.type === 'activate') {
        await self.skipWaiting()
        return
      }
      const port = event.ports[0]
      try {
        const result = await serial(async () => {
          const [images, meta] = await stores()
          if (data.type === 'configure' && typeof data.enabled === 'boolean')
            await meta.put(CONFIG, new Response(JSON.stringify({ enabled: data.enabled })))
          if (data.type === 'clear') {
            for (const req of await images.keys()) {
              await images.delete(req)
              await meta.delete(req)
            }
          }
          if (data.type === 'invalidate' && allowed(data.url)) {
            await images.delete(data.url)
            await meta.delete(data.url)
          }
          await prune(images, meta)
          return { count: (await images.keys()).length, enabled: await enabled(meta) }
        })
        port?.postMessage(result)
      } catch {
        port?.postMessage({ error: 'storage' })
      }
    })(),
  ),
)
async function runtime(request) {
  try {
    const hit = await serial(async () => {
      const [images, meta] = await stores()
      if (!(await enabled(meta))) return undefined
      await prune(images, meta)
      const r = await images.match(request)
      if (r) {
        const m = await (await meta.match(request)).json()
        await meta.put(request, new Response(JSON.stringify({ ...m, used: Date.now() })))
      }
      return r
    })
    if (hit) return hit
  } catch {
    /* Network still works when storage fails. */
  }
  const response = await fetch(request)
  if (
    response.type === 'opaque' ||
    (response.ok && response.headers.get('content-type')?.startsWith('image/'))
  ) {
    // Respect visible no-store. Opaque headers/status/size cannot be inspected.
    if (response.type !== 'opaque' && /no-store/i.test(response.headers.get('cache-control') || ''))
      return response
    try {
      await serial(async () => {
        const [images, meta] = await stores()
        if (!(await enabled(meta))) return
        await images.put(request, response.clone())
        await meta.put(
          request,
          new Response(
            JSON.stringify({ saved: Date.now(), used: Date.now(), opaque: response.type === 'opaque' }),
          ),
        )
        await prune(images, meta)
      })
    } catch {
      /* Quota errors must not break the response. */
    }
  }
  return response
}
self.addEventListener('fetch', (event) => {
  const req = event.request,
    u = new URL(req.url)
  if (req.method !== 'GET') return
  if (u.origin === self.location.origin && ASSETS.includes(u.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const c = await caches.open(SHELL)
          const hit = await c.match(u.pathname)
          if (hit) return hit
        } catch {
          /* Use network. */
        }
        return fetch(req)
      })(),
    )
    return
  }
  if (
    req.mode === 'navigate' &&
    u.origin === self.location.origin &&
    (u.pathname === BASE || u.pathname === `${BASE}index.html`)
  ) {
    event.respondWith(
      (async () => {
        try {
          const hit = await (await caches.open(SHELL)).match(BASE)
          if (hit) return hit
        } catch {
          /* Use network. */
        }
        return fetch(req)
      })(),
    )
    return
  }
  if (req.destination === 'image' && allowed(req.url)) {
    event.respondWith(
      (async () => {
        const c = await self.clients.get(event.clientId)
        if (!c || !new URL(c.url).pathname.startsWith(BASE)) return fetch(req)
        return runtime(req)
      })(),
    )
  }
})
