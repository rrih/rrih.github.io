import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  keywords: [
    'rrih',
    'Web',
    'TypeScript',
    'Next.js',
    'Cloudflare',
    'JavaScript',
    'Engineer',
    'Developer',
    'ToolForge',
    'Development Tools',
    'Web Tools',
    'Developer Utilities',
    'JSON Formatter',
    'Base64 Encoder',
    'Color Picker',
    'Code Tools',
    'Web Utilities',
    'Forge Tools',
  ],
  authors: [{ name: siteConfig.author.name }],
  creator: siteConfig.author.name,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 460,
        height: 460,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  icons: {
    icon: siteConfig.ogImage,
    apple: siteConfig.ogImage,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="light">
      <head>
        <meta name="google-adsense-account" content="ca-pub-6426570202991325" />
        <meta
          name="google-site-verification"
          content="izOncAC8z6Z5EuhYwJNR0H6FXtlb9pTGWLGtK-tajb0"
        />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: siteConfig.author.name,
              url: siteConfig.url,
              sameAs: [siteConfig.author.github],
              jobTitle: 'Web Developer',
              alumniOf: {
                '@type': 'CollegeOrUniversity',
                name: 'Tokyo Denki University',
              },
              address: {
                '@type': 'PostalAddress',
                addressRegion: 'Tokyo',
                addressCountry: 'JP',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-white text-foreground-light antialiased transition-colors duration-200 dark:bg-background-dark dark:text-foreground-dark">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
