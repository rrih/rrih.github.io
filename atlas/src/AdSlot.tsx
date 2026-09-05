import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './ad-slot.css'

export interface AdSlotProps {
  client: string
  slot: string
  enabled: boolean
  scriptReady: boolean
  scriptFailed?: boolean
  label: string
}

interface AdSize {
  width: number
  height: number
}
interface AdWindow extends Window {
  adsbygoogle?: { push: (value: Record<string, never>) => unknown }
}

// Survives React remounts and StrictMode effects, while allowing a new document its own request.
const requestedDocuments = new WeakSet<Document>()
const sizes: AdSize[] = [
  { width: 728, height: 90 },
  { width: 468, height: 60 },
  { width: 320, height: 50 },
  { width: 300, height: 50 },
]

/** The parent owns consent and script loading. Mount outside the viewer and all controls. */
export default function AdSlot(props: AdSlotProps) {
  if (
    !props.enabled ||
    !/^ca-pub-\d{16}$/.test(props.client) ||
    !/^\d{6,20}$/.test(props.slot) ||
    /^0+$/.test(props.slot)
  )
    return null
  return <ConfiguredAdSlot {...props} />
}

function ConfiguredAdSlot({ client, slot, scriptReady, scriptFailed = false, label }: AdSlotProps) {
  const host = useRef<HTMLDivElement>(null)
  const ad = useRef<HTMLModElement>(null)
  const configuration = useRef({ client, slot })
  const chosen = useRef<AdSize | null | undefined>(undefined)
  const attemptedAt = useRef<number | undefined>(undefined)
  const [size, setSize] = useState<AdSize | null | undefined>(undefined)
  const [fits, setFits] = useState(false)
  const [near, setNear] = useState(false)
  const [closed, setClosed] = useState(
    () => scriptFailed || (typeof document !== 'undefined' && requestedDocuments.has(document)),
  )

  useLayoutEffect(() => {
    const element = host.current
    if (!element) return
    const measure = () => {
      const width = element.getBoundingClientRect().width
      if (width <= 0) return
      if (chosen.current === undefined) {
        chosen.current = sizes.find((candidate) => candidate.width <= width) ?? null
        setSize(chosen.current)
      }
      setFits(!!chosen.current && width >= chosen.current.width)
    }
    measure()
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const element = host.current
    if (!element || closed) return
    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
        rootMargin: '200px 0px',
      })
      observer.observe(element)
      return () => observer.disconnect()
    }
    const inspect = () => {
      const rect = element.getBoundingClientRect()
      setNear(rect.bottom >= -200 && rect.top <= window.innerHeight + 200)
    }
    inspect()
    window.addEventListener('scroll', inspect, { passive: true })
    window.addEventListener('resize', inspect)
    return () => {
      window.removeEventListener('scroll', inspect)
      window.removeEventListener('resize', inspect)
    }
  }, [closed])

  useEffect(() => {
    if (scriptFailed) {
      setClosed(true)
      return
    }
    const element = ad.current
    if (closed || !size || !element) return
    let timeout: number | undefined
    const inspectStatus = () => {
      if (element.dataset.adStatus === 'unfilled') setClosed(true)
    }
    const observer = new MutationObserver(inspectStatus)
    observer.observe(element, { attributes: true, attributeFilter: ['data-ad-status'] })
    const expireEmptyRequest = () => {
      if (attemptedAt.current === undefined || timeout !== undefined) return
      timeout = window.setTimeout(
        () => {
          // A blocked script may accept a queue push but never create an ad. Do not interrupt an iframe.
          if (!element.dataset.adStatus && !element.querySelector('iframe')) setClosed(true)
        },
        Math.max(0, 30_000 - (performance.now() - attemptedAt.current)),
      )
    }
    const request = () => {
      if (attemptedAt.current !== undefined) {
        expireEmptyRequest()
        return
      }
      if (!scriptReady || !near || !fits || document.hidden) return
      if (requestedDocuments.has(document)) {
        setClosed(true)
        return
      }
      if (element.dataset.adStatus || element.dataset.adsbygoogleStatus) {
        requestedDocuments.add(document)
        attemptedAt.current = performance.now()
        expireEmptyRequest()
        return
      }
      // Ad blockers may hide only the ins element. Never submit an invisible, zero-size slot.
      if (element.getBoundingClientRect().width < size.width || !element.getClientRects().length) {
        setClosed(true)
        return
      }
      requestedDocuments.add(document)
      attemptedAt.current = performance.now()
      try {
        const adWindow = window as AdWindow
        const queue = adWindow.adsbygoogle ?? ([] as Record<string, never>[])
        adWindow.adsbygoogle = queue
        queue.push({})
      } catch {
        setClosed(true)
      }
      inspectStatus()
      expireEmptyRequest()
    }
    inspectStatus()
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
      document.removeEventListener('visibilitychange', request)
    }
  }, [closed, fits, near, scriptFailed, scriptReady, size])

  return (
    <div
      ref={host}
      className="atlas-ad-placement"
      data-state={closed || size === null ? 'empty' : size ? 'ready' : 'pending'}
    >
      {!closed && size && (
        <aside className="atlas-ad-slot" aria-label={label} hidden={!fits}>
          <span className="atlas-ad-label">{label}</span>
          {/* A fixed-height parent prevents mobile size expansion without clipping the ad.
              https://support.google.com/adsense/answer/9139818 */}
          <div className="atlas-ad-creative" style={{ width: size.width, height: size.height }}>
            <ins
              ref={ad}
              className="adsbygoogle"
              style={{ display: 'inline-block', width: size.width, height: size.height }}
              data-ad-client={configuration.current.client}
              data-ad-slot={configuration.current.slot}
            />
          </div>
        </aside>
      )}
    </div>
  )
}
