// Read-only connectivity evidence. Never imported by the app; no X scripts or APIs executed.
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
const local = createServer((_q, s) => {
  s.setHeader('Content-Type', 'text/html')
  s.end('<!doctype html><title>Static source probe</title>Static HTML only; no proxy')
}).listen(4190, '127.0.0.1')
const b = await chromium.launch(process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : {})
const results = []
try {
  for (const origin of [
    'http://127.0.0.1:4190/',
    process.env.PAGES_URL || 'https://rrih.github.io/tools/pictulane/',
  ]) {
    const c = await b.newContext()
    const p = await c.newPage()
    await p.goto(origin, { waitUntil: 'domcontentloaded' })
    for (const url of [
      'https://x.com/NASA/media',
      'https://x.com/NatGeo/media',
      'https://twitter.com/NASA/media',
    ]) {
      results.push({
        origin,
        url,
        ...(await p.evaluate(async (url) => {
          try {
            const r = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(12000) })
            const body = await r.text()
            const d = new DOMParser().parseFromString(body, 'text/html')
            return {
              status: r.status,
              type: r.type,
              characters: body.length,
              postArticles: d.querySelectorAll('article').length,
              postImages: [...d.images].filter((i) => i.src.startsWith('https://pbs.twimg.com/media/'))
                .length,
              tweetResults: body.includes('tweet_results'),
            }
          } catch (e) {
            return { error: String(e) }
          }
        }, url)),
      })
    }
    await c.close()
  }
} finally {
  await b.close()
  local.close()
}
await mkdir('work', { recursive: true })
await writeFile(
  'work/source-probe.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
)
console.log(JSON.stringify(results, null, 2))
