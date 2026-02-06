import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Timetable Share',
    short_name: 'Timetable',
    description: 'URLだけで共有・復元できる時間割PWA',
    start_url: '/tools/timetable/',
    scope: '/tools/timetable/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: '新しい時間割',
        short_name: '新規',
        description: 'URL同期型の時間割を開く',
        url: '/tools/timetable/',
      },
    ],
  }
}
