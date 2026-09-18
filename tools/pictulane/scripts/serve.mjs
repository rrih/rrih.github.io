import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const root = resolve(process.env.SITE_DIR || 'dist'),
  base = process.env.SITE_DIR ? '/' : '/tools/pictulane/'
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (path === '/tools/other/sw.js' && existsSync(resolve(root, 'TEST-ONLY'))) {
      res.writeHead(200, { 'Content-Type': 'text/javascript' })
      res.end("self.addEventListener('install', () => self.skipWaiting())")
      return
    }
    if (path === base.slice(0, -1)) {
      res.writeHead(301, { Location: base })
      res.end()
      return
    }
    if (!path.startsWith(base)) throw Error()
    let f = resolve(root, path.slice(base.length))
    if (!f.startsWith(root + '/') && f !== root) throw Error()
    if ((await stat(f)).isDirectory()) {
      if (!path.endsWith('/')) {
        res.writeHead(301, { Location: path + '/' })
        res.end()
        return
      }
      f += '/index.html'
    }
    const body = await readFile(f)
    res.writeHead(200, { 'Content-Type': types[extname(f)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    const missing = process.env.SITE_DIR ? await readFile(resolve(root, '404.html')).catch(() => null) : null
    res.writeHead(404, { 'Content-Type': missing ? 'text/html' : 'text/plain' })
    res.end(missing || 'Not found')
  }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () =>
  console.log(`Static preview on http://127.0.0.1:${process.env.PORT || 4173}${base}`),
)
