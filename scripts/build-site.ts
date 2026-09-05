import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import locales from '../profile/locales.json'

const output = 'dist'
const origin = 'https://rrih.github.io'
const path = (locale: string) => (locale === 'en' ? '/' : `/${locale}/`)
const escapeHTML = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
rmSync(output, { recursive: true, force: true })
mkdirSync(output)
const template = readFileSync('index.html', 'utf8')
const alternates = [
  ...Object.keys(locales).map(
    (locale) => `<link rel="alternate" hreflang="${locale}" href="${origin}${path(locale)}">`,
  ),
  `<link rel="alternate" hreflang="x-default" href="${origin}/">`,
].join('\n')
for (const [locale, copy] of Object.entries(locales)) {
  const url = `${origin}${path(locale)}`
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    name: 'rrih — Web Developer',
    inLanguage: locale,
    mainEntity: {
      '@type': 'Person',
      '@id': `${origin}/#person`,
      name: 'rrih',
      jobTitle: 'Web Developer',
      description: copy.description,
      image: 'https://github.com/rrih.png',
      url: `${origin}/`,
      sameAs: ['https://x.com/rrih_dev', 'https://github.com/rrih'],
      knowsAbout: [
        'Web development',
        'Frontend development',
        'Backend development',
        'Infrastructure',
        'TypeScript',
        'Go',
        'Cloudflare',
      ],
    },
  }
  const values: Record<string, string> = {
    ...copy,
    locale,
    direction: locale === 'ar' ? 'rtl' : 'ltr',
    url,
    ogLocale: (
      {
        en: 'en_US',
        ja: 'ja_JP',
        fr: 'fr_FR',
        de: 'de_DE',
        es: 'es_ES',
        it: 'it_IT',
        pt: 'pt_BR',
        ko: 'ko_KR',
        'zh-Hans': 'zh_CN',
        'zh-Hant': 'zh_TW',
        ar: 'ar_AR',
        ru: 'ru_RU',
      } as Record<string, string>
    )[locale],
  }
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === 'alternates') return alternates
    if (key === 'structured')
      return `<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<', '\\u003c')}</script>`
    if (key === 'languages')
      return Object.entries(locales)
        .map(
          ([code, text]) =>
            `<a href="${path(code)}" hreflang="${code}" lang="${code}"${code === locale ? ' aria-current="page"' : ''}>${text.label}</a>`,
        )
        .join('')
    if (!(key in values)) throw new Error(`Unknown template key: ${key}`)
    return escapeHTML(values[key])
  })
  mkdirSync(`${output}${path(locale)}`, { recursive: true })
  writeFileSync(`${output}${path(locale)}index.html`, html)
}
for (const file of ['style.css', 'profile-card.png', 'googleb565df21987f6d4c.html'])
  cpSync(file, `${output}/${file}`)
cpSync('profile/client.js', `${output}/profile.js`)
cpSync('scripts/retire-root-worker.js', `${output}/sw.js`)
writeFileSync(`${output}/.nojekyll`, '')
writeFileSync(`${output}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`)
writeFileSync(
  `${output}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(
    locales,
  )
    .map((locale) => `<url><loc>${origin}${path(locale)}</loc></url>`)
    .join('')}</urlset>\n`,
)
writeFileSync(
  `${output}/404.html`,
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found</title><style>body{font:18px/1.7 system-ui;margin:15vh auto;padding:24px;max-width:640px;color:#222724;background:#f6f5f1}</style></head><body><main><h1>404</h1><p>Page not found. Check the address and try again.</p></main></body></html>',
)
console.log(`Built independent personal profile in ${Object.keys(locales).length} languages.`)
