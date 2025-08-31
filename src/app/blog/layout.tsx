import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Poodware Hub',
    default: 'Web Solutions & Digital Tools Hub | Poodware',
  },
  description:
    'Practical guides, tutorials, and digital solutions for modern web challenges. Expert insights for businesses, creators, and everyday users.',
  keywords: [
    'web tools guides',
    'digital solutions',
    'business tools',
    'online tutorials',
    'web productivity',
    'digital marketing tools',
    'web security',
    'user guides',
  ],
  authors: [{ name: 'Poodware Team' }],
  openGraph: {
    type: 'website',
    siteName: 'Poodware Web Solutions Hub',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@poodware',
  },
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <Header />

      <main className="min-h-screen pt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </main>

      <Footer />
    </div>
  )
}
