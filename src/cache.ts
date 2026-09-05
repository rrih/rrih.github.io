// Preserve requests that finished before the service worker controlled the first visit.
export async function cacheOpenedView(modelUrl: string | undefined) {
  if (!navigator.serviceWorker?.controller || !navigator.onLine) return
  const artwork = Array.from(document.images)
    .map((image) => image.currentSrc || image.src)
    .filter((src) => {
      const url = new URL(src, location.href)
      return url.origin === location.origin && /^\/artwork\/\d+\.webp$/.test(url.pathname)
    })
  const urls = [...new Set([...(modelUrl ? [modelUrl] : []), ...artwork])]
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (next < urls.length && navigator.onLine) {
        const url = urls[next++]
        try {
          // The active worker handles hits locally and stores only successful responses.
          const response = await fetch(url)
          await response.arrayBuffer()
        } catch {
          // A missed cache write must never interrupt the viewer.
        }
      }
    }),
  )
}

let persistenceRequested = false
export async function retainInstalledStorage() {
  if (persistenceRequested) return
  persistenceRequested = true
  try {
    const storage = navigator.storage
    if (storage?.persist && (!storage.persisted || !(await storage.persisted()))) await storage.persist()
  } catch {
    // Unsupported, denied, or private storage still uses ordinary caching.
  }
}
