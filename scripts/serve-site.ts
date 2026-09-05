import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.env.SITE_DIR || 'dist')
const port = Number(process.env.PORT || 3342)
Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(request) {
    const url = new URL(request.url)
    let path: string
    try {
      path = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    let file = resolve(root, `.${path}`)
    if (file !== root && !file.startsWith(`${root}/`)) return new Response('Forbidden', { status: 403 })
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/'))
        return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301)
      file = resolve(file, 'index.html')
    }
    const found = existsSync(file) && statSync(file).isFile()
    const body = Bun.file(found ? file : resolve(root, '404.html'))
    const headers: Record<string, string> = { 'Cache-Control': 'public, max-age=600' }
    if (file.endsWith('/sw.js') || file.endsWith('/manifest.webmanifest'))
      headers['Cache-Control'] = 'no-cache'
    if (file.endsWith('.webmanifest')) headers['Content-Type'] = 'application/manifest+json'
    if (file.endsWith('.wasm')) headers['Content-Type'] = 'application/wasm'
    return new Response(request.method === 'HEAD' ? null : body, { status: found ? 200 : 404, headers })
  },
})
console.log(`Static site preview: http://127.0.0.1:${port}`)
