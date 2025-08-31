import { siteConfig } from '@/config/site'
import Image from 'next/image'
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 border-b border-border-light dark:border-border-dark backdrop-blur supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-background-dark/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
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
            <Link href="/blog" className="hover:text-accent transition-colors">
              Blog
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
      </div>
    </header>
  )
}
