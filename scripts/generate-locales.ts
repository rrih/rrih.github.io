import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isRTL, locales, resolveLocale } from '../src/locales'
import english from '../src/locales/ui/en.json'

const messages: Record<string, Record<string, string>> = {}
const keys = Object.keys(english).sort()
for (const [locale] of locales) {
  const dictionary = JSON.parse(readFileSync(`src/locales/ui/${locale}.json`, 'utf8')) as Record<
    string,
    string
  >
  if (JSON.stringify(Object.keys(dictionary).sort()) !== JSON.stringify(keys))
    throw new Error(`Incomplete UI: ${locale}`)
  for (const key of keys) {
    const value = dictionary[key]
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Empty translation: ${locale}/${key}`)
    const placeholders = (text: string) => JSON.stringify((text.match(/\{\w+\}/g) || []).sort())
    if (placeholders(key) !== placeholders(value)) throw new Error(`Invalid placeholders: ${locale}/${key}`)
  }
  messages[locale] = dictionary
}
const output = 'public/locales/manifests'
mkdirSync(output, { recursive: true })
for (const [locale] of locales) {
  writeFileSync(
    `${output}/${locale}.webmanifest`,
    `${JSON.stringify({
      name: 'Pokémon Atlas',
      short_name: 'Atlas',
      description: messages[locale]['A closer look at Pokémon.'],
      lang: locale,
      dir: isRTL(locale) ? 'rtl' : 'ltr',
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#101311',
      theme_color: '#101311',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    })}\n`,
  )
}
const pageMessages = Object.fromEntries(
  locales.map(([locale]) => [
    locale,
    {
      title: messages[locale]['Page not found'],
      text: messages[locale]['This page has moved. Explore Pokémon Atlas from its new home.'],
      link: messages[locale]['Open Pokémon Atlas'],
    },
  ]),
)
const encoded = JSON.stringify(pageMessages).replaceAll('<', '\\u003c')
writeFileSync(
  'public/404.html',
  `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#101311"><title>Pokémon Atlas</title><link rel="icon" href="/icon.svg"><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#101311;color:#e9eee7;font:17px/1.7 system-ui,sans-serif}main{max-width:560px;padding:32px}img{width:46px}h1{font-size:clamp(28px,7vw,42px);line-height:1.3}p{color:#a3aea0}a{display:inline-block;margin-top:16px;border:1px solid #d3ef9c66;border-radius:9px;padding:12px 20px;color:#d3ef9c;text-decoration:none}a:focus-visible{outline:2px solid #d3ef9c;outline-offset:4px}</style></head><body><main><img src="/icon.svg" alt=""><h1>Page not found</h1><p>This page has moved. Explore Pokémon Atlas from its new home.</p><a href="/">Open Pokémon Atlas</a></main><script>
const words=${encoded};
const localeCodes=new Map(Object.keys(words).map(code=>[code.toLowerCase(),code]));
const resolveLocale=${resolveLocale.toString()};
let saved=null;try{saved=localStorage.getItem('atlas-language')}catch{}
const language=resolveLocale(new URLSearchParams(location.search).get('lang'))||resolveLocale(saved)||(navigator.languages||[]).map(resolveLocale).find(Boolean)||'en';
const copy=words[language];document.documentElement.lang=language;document.documentElement.dir=['ar','he','fa','ur'].includes(language)?'rtl':'ltr';document.title=copy.title+' · Pokémon Atlas';document.querySelector('h1').textContent=copy.title;document.querySelector('p').textContent=copy.text;const link=document.querySelector('a');link.textContent=copy.link;link.href='/?lang='+encodeURIComponent(language);
</script></body></html>\n`,
)
console.log(`Verified ${locales.length} locale dictionaries; generated localized app manifests and 404 page.`)
