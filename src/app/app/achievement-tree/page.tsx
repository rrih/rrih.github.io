'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { AchievementTreeApp } from './_components/achievement-tree-app'

export default function AchievementTreePage() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null)

  useEffect(() => {
    if (!hostRef.current || shadowRoot) return
    const root = hostRef.current.attachShadow({ mode: 'open' })
    setShadowRoot(root)
  }, [shadowRoot])

  return (
    <div ref={hostRef}>{shadowRoot ? createPortal(<AchievementTreeApp />, shadowRoot) : null}</div>
  )
}
