export async function workerMessage(
  type: string,
  data: Record<string, unknown> = {},
): Promise<{ count?: number; enabled?: boolean; error?: string }> {
  const sw = navigator.serviceWorker?.controller
  if (!sw) return { error: 'unavailable' }
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => {
      channel.port1.close()
      resolve({ error: 'timeout' })
    }, 2500)
    channel.port1.onmessage = (e) => {
      clearTimeout(timer)
      channel.port1.close()
      resolve(e.data)
    }
    sw.postMessage({ type, ...data }, [channel.port2])
  })
}
export async function registerWorker(onUpdate: (registration: ServiceWorkerRegistration) => void) {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  try {
    const r = await navigator.serviceWorker.register('/tools/pictulane/sw.js', {
      scope: '/tools/pictulane/',
      updateViaCache: 'none',
    })
    if (r.waiting) onUpdate(r)
    r.addEventListener('updatefound', () => {
      const w = r.installing
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) onUpdate(r)
      })
    })
  } catch {
    /* Browsing remains available without PWA storage. */
  }
}
