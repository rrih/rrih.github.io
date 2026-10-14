import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import formModels from './src/data/forms.json'
import models from './src/data/models.json'

const worker = JSON.parse(readFileSync(new URL('./worker/pkg/workbox.json', import.meta.url), 'utf8'))

const alternateModels = formModels
const modelCount = new Set(
  [...Object.values(models), ...alternateModels.map((form) => form.model)].flatMap((model) =>
    'shiny' in model && model.shiny ? [model.url, model.shiny] : [model.url],
  ),
).size

export default defineConfig({
  base: '/atlas/',
  plugins: [
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
      injectRegister: false,
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
        importScripts: [worker.importScript],
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
                    const policy = await self.atlasWorker()
                    return policy.preview_fallback(request.url)
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
                    const policy = await self.atlasWorker()
                    return policy.cache_key(request.url, 'artwork')
                  },
                  handlerDidError: async () => {
                    const policy = await self.atlasWorker()
                    return policy.artwork_unavailable()
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
                    const policy = await self.atlasWorker()
                    return policy.cache_key(request.url, 'models')
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
                    const policy = await self.atlasWorker()
                    return policy.navigation_fallback(request.url)
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
    emptyOutDir: false,
    rollupOptions: {
      output: { manualChunks: { three: ['three/webgpu', 'three/tsl'] } },
    },
  },
})
