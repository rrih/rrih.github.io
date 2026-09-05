import { useCallback, useEffect, useRef, useState } from 'react'

type Updater = (reloadPage?: boolean) => Promise<void>
interface Listener {
  refresh: (value: boolean) => void
  reload: () => void
}
const listeners = new Set<Listener>()
let refreshNeeded = false
let registration: Promise<Updater> | undefined

function register(): Promise<Updater> {
  registration ??= import('virtual:pwa-register')
    .then(({ registerSW }) =>
      registerSW({
        immediate: true,
        onNeedRefresh() {
          refreshNeeded = true
          for (const listener of listeners) listener.refresh(true)
        },
        onNeedReload() {
          for (const listener of listeners) listener.reload()
        },
      }),
    )
    .catch((error) => {
      registration = undefined
      throw error
    })
  return registration
}

/** Start first-visit offline preparation after the initial model settles. */
export function useDeferredSW(modelSettled: boolean, options: { onNeedReload: () => void }) {
  const [needRefresh, setNeedRefresh] = useState(refreshNeeded)
  const latest = useRef(options)
  latest.current = options
  useEffect(() => {
    const listener = { refresh: setNeedRefresh, reload: () => latest.current.onNeedReload() }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const start = () => {
      void register().catch(() => {
        /* Offline preparation is optional. */
      })
    }
    const alreadyControlled = navigator.serviceWorker.controller?.scriptURL.includes('/atlas/sw.js')
    // A stalled first model must not prevent installation indefinitely.
    const timeout = window.setTimeout(start, modelSettled || alreadyControlled ? 250 : 30_000)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [modelSettled])

  const updateServiceWorker = useCallback(async (reloadPage?: boolean) => {
    const update = await register()
    await update(reloadPage)
  }, [])
  return { needRefresh: [needRefresh, setNeedRefresh] as const, updateServiceWorker }
}
