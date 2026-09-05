import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'

const output = 'hosting'
rmSync(output, { recursive: true, force: true })
mkdirSync(output)
cpSync('public/ads.txt', `${output}/ads.txt`)
const redirect = (path: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pokémon Atlas</title><link rel="canonical" href="https://rrih.github.io/atlas${path}"><meta http-equiv="refresh" content="0;url=/atlas${path}"></head><body><a href="/atlas${path}">Open Pokémon Atlas</a><script>const target=new URL(${JSON.stringify(`/atlas${path}`)},location.origin);target.search=location.search;target.hash=location.hash;location.replace(target.href)</script></body></html>`
for (const prefix of ['', '/ja'])
  for (let id = 1; id <= 1025; id++) {
    const path = `${prefix}/pokemon/${id}/`
    mkdirSync(`${output}${path}`, { recursive: true })
    writeFileSync(`${output}${path}index.html`, redirect(path))
  }
for (const language of ['en', 'ja'])
  for (const name of ['rights', 'terms', 'privacy']) {
    mkdirSync(`${output}/legal/${language}`, { recursive: true })
    writeFileSync(`${output}/legal/${language}/${name}.html`, redirect(`/legal/${language}/${name}.html`))
  }
mkdirSync(`${output}/terms`)
writeFileSync(`${output}/terms/index.html`, redirect('/legal/en/terms.html'))
