import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { copyDirectory } from './scripts/copy-directory'
import formModels from './src/data/forms.json'
import models from './src/data/models.json'

const alternateModels = formModels as { model: { url: string; shiny?: string } }[]
const modelCount = new Set(
  [...Object.values(models), ...alternateModels.map((form) => form.model)].flatMap((model) =>
    'shiny' in model && model.shiny ? [model.url, model.shiny] : [model.url],
  ),
).size

export default defineConfig({
  base: '/atlas/',
  plugins: [
    react(),
    {
      name: 'copy-public-assets',
      apply: 'build',
      writeBundle() {
        // writeBundle runs before Workbox scans the output in closeBundle.
        copyDirectory(new URL('./public', import.meta.url), new URL('./dist', import.meta.url))
      },
    },
    VitePWA({
      integration: {
        beforeBuildServiceWorker(options) {
          options.workbox.additionalManifestEntries?.sort((a, b) => {
            const left = typeof a === 'string' ? a : a.url
            const right = typeof b === 'string' ? b : b.url
            return left < right ? -1 : left > right ? 1 : 0
          })
        },
      },
      registerType: 'prompt',
      scope: '/atlas/',
      includeAssets: [
        'icon.svg',
        'apple-touch-icon.png',
        'models/home/6.glb',
        'draco/*',
        'locales/catalog/*.json',
        'locales/ui/*.json',
        'locales/manifests/*.webmanifest',
        ...Array.from({ length: 24 }, (_, index) => `artwork/${index + 1}.webp`),
      ],
      manifest: {
        name: 'Pokémon Atlas',
        short_name: 'Atlas',
        description: 'An interactive 3D Pokédex and scene studio.',
        theme_color: '#101311',
        background_color: '#101311',
        display: 'standalone',
        start_url: '/atlas/',
        lang: 'en',
        dir: 'ltr',
        scope: '/atlas/',
        id: '/atlas/',
        icons: [
          { src: '/atlas/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/atlas/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/atlas/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        manifestTransforms: [
          async (entries) => ({
            manifest: [...entries].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)),
            warnings: [],
          }),
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,webp,wasm,woff2}'],
        globIgnores: ['artwork/**', 'previews/**', 'habitat.webp', '**/pokemon/**'],
        navigateFallback: undefined,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/atlas\/previews\/(?:forms\/)?[a-z\d-]+\.webp$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'atlas-previews-v1',
              plugins: [
                {
                  handlerDidError: async ({ request }) => {
                    const species = new URL(request.url).pathname.match(/\/previews\/(\d+)\.webp$/)?.[1]
                    if (species) {
                      for (const path of [`/artwork/${species}.webp`, `/atlas/artwork/${species}.webp`]) {
                        const artwork = await caches.match(path, { ignoreSearch: true })
                        if (artwork) return artwork
                      }
                    }
                    // This response bypasses the preview cache, so reconnection fetches the real image.
                    const icon = await caches.match('/atlas/icon.svg', { ignoreSearch: true })
                    return icon || new Response('', { status: 503 })
                  },
                },
              ],
              expiration: { maxEntries: 1145, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/artwork\/\d+\.webp$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'atlas-artwork-v1',
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const url = new URL(request.url)
                    url.pathname = url.pathname.replace(/^\/atlas\/artwork\//, '/artwork/')
                    return url.href
                  },
                },
              ],
              expiration: { maxEntries: 1025, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/models\/.*\.glb$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'atlas-models-v1',
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const url = new URL(request.url)
                    url.pathname = url.pathname.replace(/^\/atlas\/models\//, '/models/')
                    return url.href
                  },
                },
              ],
              expiration: { maxEntries: modelCount, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' && url.pathname.startsWith('/atlas/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'atlas-pages-v1',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  handlerDidError: async ({ request }) => {
                    const path = new URL(request.url).pathname.replace(
                      /^\/atlas\/(?:ja|fr|de|es|it|ko|zh-Hans|zh-Hant)\//,
                      '/atlas/',
                    )
                    const species = path.match(/^\/atlas\/pokemon\/(\d+)\/(?:forms\/[a-z\d-]+\/)?$/)
                    const valid =
                      path === '/atlas/' || (species && Number(species[1]) >= 1 && Number(species[1]) <= 1025)
                    if (valid) {
                      const fallback = await caches.match('/atlas/index.html', { ignoreSearch: true })
                      if (fallback) return fallback
                    }
                    return new Response(
                      '<!doctype html><meta name="robots" content="noindex"><title>Offline</title><p>This page is not saved offline.</p><a href="/atlas/">Pokémon Atlas</a>',
                      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
                    )
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  build: {
    copyPublicDir: false,
    rollupOptions: {
      output: { manualChunks: { three: ['three/webgpu', 'three/tsl'], react: ['react', 'react-dom'] } },
    },
  },
})
