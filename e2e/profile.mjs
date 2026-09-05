import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const origin = process.env.PROFILE_URL || 'http://127.0.0.1:3343'
const output = process.env.PROFILE_QA_DIR || 'work/profile-independence/profile-qa'
await mkdir(output, { recursive: true })
const locales = JSON.parse(await readFile(new URL('../profile/locales.json', import.meta.url)))
const browser = await chromium.launch({channel:'chrome',headless:true})
const context = await browser.newContext({viewport:{width:1440,height:1000}})
const page = await context.newPage()
const errors=[],requests=[],results=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('request',r=>requests.push(r.url()))
try {
for (const code of Object.keys(locales)) {
 const path=code==='en'?'/':`/${code}/`
 const response=await page.goto(origin+path)
 assert.equal(response.status(),200)
 assert.equal(await page.locator('h1').innerText(),'rrih')
 assert.equal(await page.locator('html').getAttribute('lang'),code)
 assert.equal(await page.locator('link[rel=manifest]').count(),0)
 assert.equal(await page.locator('a[href="https://x.com/rrih_dev"]').count(),1)
 assert.equal(await page.locator('a[href="https://github.com/rrih"]').count(),1)
 assert.equal(await page.locator('.avatar').getAttribute('src'),'https://github.com/rrih.png')
 assert.deepEqual(await page.evaluate(()=>Array.from(document.querySelectorAll('a[href^="https:"]'),x=>x.href).sort()),['https://github.com/rrih','https://x.com/rrih_dev'])
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:width===1440?1000:844})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${code}/${width}: overflow`)
  await page.locator('summary').click()
  assert(await page.locator('.languages nav').isVisible())
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('details').getAttribute('open'),null)
  if(['en','ja','ar'].includes(code))await page.screenshot({path:`${output}/${code}-${width}.png`,fullPage:true})
 }
 results.push({locale:code,widths:[1440,390,320],status:response.status()})
}
await page.goto(origin+'/?lang=ja#pokemon=6&scene=studio')
await page.waitForURL(origin+'/ja/')
assert.equal(await page.locator('canvas').count(),0)
await page.locator('summary').click()
await page.locator('nav a[hreflang=en]').click()
await page.waitForURL(origin+'/')
await page.evaluate(()=>localStorage.setItem('atlas-language','ja'))
await page.goto(origin+'/#pokemon=753&scene=forest')
assert.equal(new URL(page.url()).pathname,'/')
assert.equal(await page.evaluate(()=>localStorage.getItem('atlas-language')),'ja')
const cdp=await context.newCDPSession(page)
const install=await cdp.send('Page.getInstallabilityErrors')
assert(install.installabilityErrors.length>0)
assert.equal((await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(x=>x.length))),0)
assert.equal(requests.filter(x=>new URL(x).pathname.startsWith('/atlas')).length,0)
assert.deepEqual(errors,[])
await writeFile(`${output}/results.json`,JSON.stringify({results,errors,noApplicationRequests:true,noServiceWorker:true,installabilityErrors:install.installabilityErrors},null,2))
console.log('12 languages × 3 widths; independent routes, links, metadata and no PWA passed.')
}finally{await browser.close()}
