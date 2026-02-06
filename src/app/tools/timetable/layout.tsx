import { generateToolMetadata } from '@/lib/metadata'
import type { Viewport } from 'next'

export const metadata = {
  ...generateToolMetadata('timetable'),
  manifest: '/tools/timetable/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Timetable Share',
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
