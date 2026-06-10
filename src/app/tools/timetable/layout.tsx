import { generateToolMetadata } from '@/lib/metadata'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  ...generateToolMetadata('timetable'),
  applicationName: 'Timetable Share',
  manifest: '/tools/timetable/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Timetable Share',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  colorScheme: 'light dark',
}

export default function TimetableLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
