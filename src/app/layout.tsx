import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.author.name }],
  creator: siteConfig.author.name,
  metadataBase: new URL(siteConfig.url),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
  formatDetection: {
    telephone: false,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/icons/icon-512x512.png"],
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    shortcut: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
    other: {
      rel: "apple-touch-icon-precomposed",
      url: "/icons/icon-192x192.png",
    },
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
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
              "@context": "https://schema.org",
              "@type": "Person",
              name: siteConfig.author.name,
              url: siteConfig.url,
              sameAs: [siteConfig.author.github],
              jobTitle: "Web Developer",
              alumniOf: {
                "@type": "CollegeOrUniversity",
                name: "Tokyo Denki University",
              },
              address: {
                "@type": "PostalAddress",
                addressRegion: "Tokyo",
                addressCountry: "JP",
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-white text-foreground-light antialiased transition-colors duration-200 dark:bg-background-dark dark:text-foreground-dark">
        <ToastProvider>{children}</ToastProvider>
        <InstallPrompt />
      </body>
    </html>
  );
}
