'use client'

import { detectLocaleFromPathname } from '@/lib/i18n'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function LocaleDocumentSync() {
  const pathname = usePathname()

  useEffect(() => {
    const locale = detectLocaleFromPathname(pathname) ?? 'ja'
    document.documentElement.lang = locale
  }, [pathname])

  return null
}
