import { siteConfig } from "@/config/site";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border-light pb-5 mb-15 dark:border-border-dark">
      <Link
        href="/"
        className="text-xl font-semibold tracking-tight hover:text-accent transition-colors"
      >
        {siteConfig.name}
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
  );
}
