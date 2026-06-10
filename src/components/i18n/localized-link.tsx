'use client'

import { detectLocaleFromPathname, localizePath } from '@/lib/i18n'
import Link, { type LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

interface LocalizedLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'href'>,
    LinkProps {
  href: string
  children: ReactNode
}

function isExternalHref(href: string) {
  return /^(https?:|mailto:|tel:|#)/.test(href)
}

export function LocalizedLink({ href, children, ...props }: LocalizedLinkProps) {
  const pathname = usePathname()
  const locale = detectLocaleFromPathname(pathname)
  const resolvedHref = isExternalHref(href) ? href : localizePath(href, locale)

  return (
    <Link href={resolvedHref} {...props}>
      {children}
    </Link>
  )
}
