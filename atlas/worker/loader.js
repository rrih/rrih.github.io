// Browser ABI only: load the content-matched Rust policy from Workbox's precache.
importScripts('/atlas/__BINDINGS__')
let atlasWorkerReady
self.atlasWorker = () => atlasWorkerReady ||= (async () => {
  const url = '/atlas/__WASM__'
  const cached = await caches.match(url, { ignoreSearch: true })
  await wasm_bindgen({ module_or_path: cached || await fetch(url, { cache: 'reload' }) })
  return wasm_bindgen
})().catch((error) => { atlasWorkerReady = undefined; throw error })
