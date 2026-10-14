/* Browser service-worker event ABI. Cache policy is implemented by pictulane-worker Rust. */
const SHELL = 'pictulane-shell-__BUILD__'
const ASSETS = __ASSETS__
const WASM = '__WORKER_WASM__'
importScripts('__WORKER_JS__')
// A worker's own WASM fetch is outside its fetch handler. Read the version-matched shell
// to bootstrap offline; the Rust install handler populates this same shell atomically.
const ready = (async () => {
  let module
  try { module = await caches.match(WASM, { cacheName: SHELL }) } catch { /* Network fallback. */ }
  await wasm_bindgen({ module_or_path: module || await fetch(WASM, { cache: 'reload' }) })
  wasm_bindgen.initialize(SHELL, ASSETS)
})()
self.addEventListener('install', (event) => event.waitUntil(ready.then(() => wasm_bindgen.on_install())))
self.addEventListener('activate', (event) => event.waitUntil(ready.then(() => wasm_bindgen.on_activate())))
self.addEventListener('message', (event) => event.waitUntil(ready.then(() => wasm_bindgen.on_message(event))))
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    event.respondWith(ready.then(() => wasm_bindgen.on_fetch(event.request, event.clientId)))
  }
})
