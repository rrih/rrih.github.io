import { ChevronLeft, Home } from 'lucide-react'
import Link from 'next/link'

interface BreadcrumbNavProps {
  items: Array<{
    label: string
    href?: string
  }>
}

export function BreadcrumbNav({ items }: BreadcrumbNavProps) {
  return (
    <nav className="mb-8 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <Link
        href="/"
        className="flex items-center gap-1 text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
      >
        <Home className="w-4 h-4" />
        <span className="hidden sm:inline">Home</span>
      </Link>

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronLeft className="w-4 h-4 text-foreground-light-secondary dark:text-foreground-dark-secondary rotate-180" />
          {item.href ? (
            <Link
              href={item.href}
              className="text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground-light dark:text-foreground-dark">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}
