import { chromium as playwrightChromium, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export { expect }
export const siteOrigin = new URL(process.env.ATLAS_URL || 'http://127.0.0.1:3342').origin
export const appBase = `${siteOrigin}/atlas`
export const siteDist = fileURLToPath(new URL('../../site-dist/', import.meta.url))
export const appPath = path => path.startsWith('/atlas/') || path === '/atlas' ? path : `/atlas${path.startsWith('/') ? path : `/${path}`}`
export const seoLocales = ['en', 'ja', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant']
export const localeHome = code => `/atlas/${seoLocales.includes(code) && code !== 'en' ? `${code}/` : code === 'es-419' ? 'es/' : ''}`
export const urlLocale = address => { const url = new URL(address); return url.searchParams.get('lang') || (seoLocales.includes(url.pathname.split('/')[2]) ? url.pathname.split('/')[2] : 'en') }
export const manifestStart = code => code === 'en' ? '/atlas/' : `${localeHome(code)}?lang=${code}`

// Ordinary regression tests never contact advertising, analytics, or unrelated hosts.
// The separate advertising/CMP and privacy harnesses provide explicit local fixtures
// or their own narrow Google-script allowlist; all delivery/measurement is intercepted.
export const chromium = {
  async launch(options) {
    const browser = await playwrightChromium.launch(options)
    const newContext = browser.newContext.bind(browser)
    browser.newContext = async contextOptions => {
      const context = await newContext(contextOptions)
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        return url.origin === siteOrigin || ['127.0.0.1', 'localhost'].includes(url.hostname)
          ? route.continue()
          : route.abort('blockedbyclient')
      })
      return context
    }
    return browser
  },
}
