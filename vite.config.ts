import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import models from './src/data/models.json'

const modelCount = Object.keys(models).length + Object.values(models).filter((model) => 'shiny' in model).length

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'icon.svg',
        'apple-touch-icon.png',
        'habitat.webp',
        'models/home/6.glb',
        'draco/*',
        'locales/catalog/*.json',
        'locales/manifests/*.webmanifest',
        ...Array.from({ length: 24 }, (_, index) => `artwork/${index + 1}.webp`),
      ],
      manifest: {
        name: 'Pokémon Atlas',
        short_name: 'Atlas',
        description: 'A closer look at Pokémon.',
        theme_color: '#101311',
        background_color: '#101311',
        display: 'standalone',
        start_url: '/',
        lang: 'en',
        dir: 'ltr',
        scope: '/',
        id: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,webp,wasm,woff2}'],
        globIgnores: ['artwork/**'],
        navigateFallbackDenylist: [/^\/assets\//, /^\/models\//, /^\/draco\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/artwork\/\d+\.webp$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'atlas-artwork-v1',
              expiration: { maxEntries: 1025, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/models\/.*\.glb$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'atlas-models-v1',
              expiration: { maxEntries: modelCount, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ['three/webgpu', 'three/tsl'], react: ['react', 'react-dom'] } },
    },
  },
})
