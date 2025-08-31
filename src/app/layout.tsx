import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { ToastProvider } from '@/components/ui/toast'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.author.name }],
  creator: siteConfig.author.name,
  metadataBase: new URL(siteConfig.url),
  manifest: '/manifest.json',
  applicationName: siteConfig.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: siteConfig.name,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    shortcut: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/icons/icon-192x192.png',
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: '/og/home.png',
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - ${siteConfig.tagline}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: ['/og/home.png'],
    creator: `@${siteConfig.author.name}`,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0066cc',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="light">
      <head>
        <meta name="theme-color" content="#0066cc" />
        <meta name="msapplication-TileColor" content="#0066cc" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
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
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-white text-foreground-light antialiased transition-colors duration-200 dark:bg-background-dark dark:text-foreground-dark">
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-4GYW68LVTM"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-4GYW68LVTM');
          `}
        </Script>

        <ToastProvider>{children}</ToastProvider>
        <InstallPrompt />
      </body>
    </html>
  )
}
