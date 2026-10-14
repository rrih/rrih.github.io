import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'

export const base = '/tools/pictulane/'
type Files = Map<string, Buffer>
export type Release = {
  files: Files
  bootstrap: string
  appJs: string
  appWasm: string
  workerJs: string
  workerWasm: string
  shell: string
}
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

async function readTree(path: string, prefix = ''): Promise<Files> {
  const files: Files = new Map()
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`
    if (entry.isDirectory()) {
      for (const [key, value] of await readTree(`${path}/${entry.name}`, `${name}/`)) files.set(key, value)
    } else if (entry.name !== 'TEST-ONLY') files.set(name, await readFile(`${path}/${entry.name}`))
  }
  return files
}

function packageHash(files: Files): string {
  const hash = createHash('sha256')
  for (const path of [...files.keys()].sort()) {
    const bytes = files.get(path)!
    for (const value of [Buffer.from(path), bytes]) {
      const length = Buffer.alloc(8)
      length.writeBigUInt64LE(BigInt(value.length))
      hash.update(length).update(value)
    }
  }
  return hash.digest('hex').slice(0, 20)
}

// Change one real WASM export, retaining every implementation byte. Each pair
// remains functional, but crossing its JS and WASM generations must fail.
function renameExport(original: Buffer, from: string, to: string): Buffer {
  if (Buffer.byteLength(from) !== Buffer.byteLength(to)) throw new Error('export length mismatch')
  const bytes = Buffer.from(original)
  let cursor = 8
  const integer = () => {
    let value = 0
    let shift = 0
    for (;;) {
      const byte = bytes[cursor++]
      value |= (byte & 127) << shift
      if (!(byte & 128)) return value
      shift += 7
    }
  }
  while (cursor < bytes.length) {
    const section = bytes[cursor++]
    const size = integer()
    const end = cursor + size
    if (section === 7) {
      const count = integer()
      for (let index = 0; index < count; index++) {
        const length = integer()
        const start = cursor
        cursor += length
        const name = bytes.toString('utf8', start, cursor)
        cursor++ // export kind
        integer() // function/table/global index
        if (name === from) {
          bytes.write(to, start, 'utf8')
          return bytes
        }
      }
    }
    cursor = end
  }
  throw new Error(`Missing WASM export: ${from}`)
}

export async function releaseFromDist(generation: 'a' | 'b' | 'c'): Promise<Release> {
  const original = await readTree('dist')
  const index = original.get('index.html')!.toString()
  const oldBootstrap = index.match(/src="\/tools\/pictulane\/(bootstrap-[a-f0-9]{20}\.js)"/)?.[1]
  if (!oldBootstrap) throw new Error('Pictulane must be built with immutable runtime URLs')
  const originalBoot = original.get(oldBootstrap)!.toString()
  const oldApp = originalBoot.match(/\/tools\/pictulane\/(pkg-[a-f0-9]{20})\/pictulane\.js/)?.[1]
  const oldWorker = original.get('sw.js')!.toString().match(/\/tools\/pictulane\/(worker-[a-f0-9]{20})\//)?.[1]
  if (!oldApp || !oldWorker) throw new Error('Missing versioned app/worker package')
  const files: Files = new Map()
  for (const [path, bytes] of original) {
    if (path !== 'sw.js' && path !== oldBootstrap && !path.startsWith(`${oldApp}/`) && !path.startsWith(`${oldWorker}/`)) {
      files.set(path, bytes)
    }
  }
  function variant(oldDirectory: string, prefix: string, stem: string, from: string, to: string): string {
    const entries: Files = new Map()
    for (const [path, bytes] of original) {
      if (path.startsWith(`${oldDirectory}/`)) entries.set(path.slice(oldDirectory.length + 1), bytes)
    }
    const js = entries.get(`${stem}.js`)!.toString()
    const access = `wasm.${from}(`
    if (js.split(access).length !== 2) throw new Error(`Expected one JS export access: ${access}`)
    entries.set(`${stem}.js`, Buffer.from(js.replace(access, `wasm.${to}(`)))
    entries.set(`${stem}_bg.wasm`, renameExport(entries.get(`${stem}_bg.wasm`)!, from, to))
    const directory = `${prefix}-${packageHash(entries)}`
    for (const [path, bytes] of entries) files.set(`${directory}/${path}`, bytes)
    return directory
  }
  const app = variant(oldApp, 'pkg', 'pictulane', '__wbindgen_start', `__wbindgen_sta_${generation}`)
  const worker = variant(oldWorker, 'worker', 'pictulane_worker', 'initialize', `initializ${generation}`)
  const boot = originalBoot.replace(`${base}${oldApp}/`, `${base}${app}/`)
    .replace('await init()', `if (globalThis.__pictulaneBootGate) { globalThis.__pictulaneBootPaused = true; await globalThis.__pictulaneBootGate }\nawait init()`)
  const bootstrap = `bootstrap-${digest(boot).slice(0, 20)}.js`
  files.set(bootstrap, Buffer.from(boot))
  files.set('index.html', Buffer.from(index.replace(oldBootstrap, bootstrap)))
  const source = (await readFile('public/sw.js', 'utf8'))
    .replace('__WORKER_JS__', `${base}${worker}/pictulane_worker.js`)
    .replace('__WORKER_WASM__', `${base}${worker}/pictulane_worker_bg.wasm`)
  const hash = createHash('sha256')
  for (const path of [...files.keys()].sort()) hash.update(files.get(path)!)
  hash.update(source)
  const version = hash.digest('hex').slice(0, 12)
  const assets = [base, ...[...files.keys()].sort().map(path => `${base}${path}`)]
  files.set('sw.js', Buffer.from(source.replace('__BUILD__', version).replace('__ASSETS__', JSON.stringify(assets))))
  return {
    files, bootstrap: `${base}${bootstrap}`, appJs: `${base}${app}/pictulane.js`,
    appWasm: `${base}${app}/pictulane_bg.wasm`, workerJs: `${base}${worker}/pictulane_worker.js`,
    workerWasm: `${base}${worker}/pictulane_worker_bg.wasm`, shell: `pictulane-shell-${version}`,
  }
}

// A real HTTP origin preserves the browser HTTP cache; Playwright routing would
// disable that cache and cannot reproduce an uncontrolled deployment upgrade.
export async function releaseServer(initial: Release) {
  let current = initial
  const requests: string[] = []
  const server = createServer((request, response) => {
    const path = new URL(request.url!, 'http://fixture.invalid').pathname
    requests.push(path)
    const relative = path === base ? 'index.html' : path.startsWith(base) ? path.slice(base.length) : ''
    const bytes = current.files.get(relative)
    if (!bytes) { response.writeHead(404).end('Missing release asset'); return }
    const ext = relative.split('.').pop()!
    const mime: Record<string, string> = {
      js: 'application/javascript', wasm: 'application/wasm', html: 'text/html; charset=utf-8',
      css: 'text/css', png: 'image/png', svg: 'image/svg+xml', webmanifest: 'application/manifest+json',
    }
    response.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': relative === 'sw.js' || ext === 'html' ? 'no-store' : 'public, max-age=31536000, immutable',
    })
    response.end(bytes)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture server port')
  return {
    origin: `http://127.0.0.1:${address.port}`, requests,
    setRelease: (release: Release) => { current = release },
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
