import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border-light pt-8 pb-6 dark:border-border-dark">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link
            href="/privacy"
            className="text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="text-border-light dark:text-border-dark">•</span>
          <Link
            href="/terms"
            className="text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
          >
            Terms of Service
          </Link>
          <span className="text-border-light dark:text-border-dark">•</span>
          <Link
            href="/about"
            className="text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
          >
            About
          </Link>
        </div>
        <p className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
          © 2025 rrih
        </p>
      </div>
    </footer>
  );
}
