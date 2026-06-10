'use client'

import { ADSENSE_CLIENT, type AdSlotKey, getAdSlotId } from '@/config/ads'
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

interface AdUnitProps {
  slot: AdSlotKey
  className?: string
}

export function AdUnit({ slot, className }: AdUnitProps) {
  const slotId = getAdSlotId(slot)
  const insRef = useRef<HTMLModElement>(null)
  const pushedRef = useRef(false)

  useEffect(() => {
    if (!slotId || pushedRef.current) return
    // data-ad-status is set by AdSense once it has filled the element
    if (!insRef.current || insRef.current.getAttribute('data-ad-status')) return
    try {
      const queue = window.adsbygoogle ?? []
      window.adsbygoogle = queue
      queue.push({})
      pushedRef.current = true
    } catch {
      // adsbygoogle.js blocked or not loaded; fail silently
    }
  }, [slotId])

  if (!slotId) return null

  return (
    <div className={className}>
      <ins
        ref={insRef}
        className="adsbygoogle block min-h-[280px] w-full"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
