'use client'

import { Share2 } from 'lucide-react'

interface ShareButtonProps {
  title: string
  excerpt: string
}

export default function ShareButton({ title, excerpt }: ShareButtonProps) {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title,
        text: excerpt,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
    >
      <Share2 className="w-4 h-4" />
      Share
    </button>
  )
}
