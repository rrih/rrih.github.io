import { siteConfig } from '@/config/site'
import Image from 'next/image'
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border-light pb-3 mb-8 dark:border-border-dark">
      <Link
        href="/"
        className="flex items-center gap-3 text-xl font-semibold tracking-tight hover:text-accent transition-colors"
      >
        <div className="relative w-8 h-8 sm:w-10 sm:h-10">
          <Image
            src="/icons/poodware_1024.png"
            alt="Poodware Logo"
            width={40}
            height={40}
            // className="rounded-lg shadow-sm"
          />
        </div>
        <span className="hidden xs:inline">{siteConfig.name}</span>
      </Link>
      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/#tools" className="hover:text-accent transition-colors">
            Tools
          </Link>
          <Link href="/about" className="hover:text-accent transition-colors">
            About
          </Link>
          <Link
            href={siteConfig.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            GitHub
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  )
}
