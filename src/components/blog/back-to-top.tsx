'use client'

export function BackToTop() {
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      className="inline-flex items-center rounded-lg bg-accent/10 px-4 py-2 text-accent hover:bg-accent/20 transition-colors"
    >
      Back to Top
    </button>
  )
}
