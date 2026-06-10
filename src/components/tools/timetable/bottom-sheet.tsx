'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface BottomSheetProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}

export function BottomSheet({ open, title, subtitle, onClose, children }: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const closingRef = useRef(false)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const requestClose = useCallback(() => {
    if (closingRef.current) {
      return
    }

    closingRef.current = true
    setIsVisible(false)
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closingRef.current = false
      onClose()
    }, 220)
  }, [clearCloseTimer, onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    closingRef.current = false
    setIsVisible(false)
    const rafId = window.requestAnimationFrame(() => {
      setIsVisible(true)
    })

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose()
      }
    }

    window.addEventListener('keydown', onKeydown)

    return () => {
      window.cancelAnimationFrame(rafId)
      clearCloseTimer()
      closingRef.current = false
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeydown)
    }
  }, [clearCloseTimer, open, requestClose])

  if (!open) {
    return null
  }

  return (
    <dialog
      open
      className={cn(
        'fixed inset-0 z-[100] m-0 h-screen w-screen max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 outline-none transition-opacity duration-200',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      aria-label={title}
    >
      <button
        type="button"
        aria-label="ボトムシートを閉じる"
        className={cn(
          'absolute inset-0 bg-slate-500/45 backdrop-blur-[2px] transition-opacity duration-200',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={requestClose}
      />
      <section
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border-light bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 shadow-2xl transition-transform duration-200 dark:border-border-dark dark:bg-card-dark sm:px-6',
          isVisible ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
        <header className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        {children}
      </section>
    </dialog>
  )
}
