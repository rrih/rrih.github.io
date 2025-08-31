'use client'

import { useState } from 'react'

interface EmailRevealProps {
  className?: string
}

export function EmailReveal({ className }: EmailRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false)

  const handleReveal = () => {
    setIsRevealed(true)
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-border-light bg-card-light p-4 transition-all hover:-translate-y-0.5 hover:border-accent dark:border-border-dark dark:bg-card-dark cursor-pointer ${className}`}
      onClick={handleReveal}
    >
      <div className="text-accent">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-10 5L2 7" />
        </svg>
      </div>
      <div className="text-sm">
        {isRevealed ? (
          <a
            href="mailto:origabird0911@gmail.com"
            className="text-inherit hover:text-accent"
            onClick={(e) => e.stopPropagation()}
          >
            origabird0911@gmail.com
          </a>
        ) : (
          'email (click to reveal)'
        )}
      </div>
    </div>
  )
}
