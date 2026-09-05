import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { appBase, siteOrigin, siteDist, expect } from './helpers.mjs'
const output=process.env.ATLAS_QA_DIR || 'work/profile-independence/pwa-qa'
await mkdir(output,{recursive:true})
const legacy = process.env.SKIP_LEGACY_FIXTURE !== '1'
const fixture=`${siteDist}/legacy-test-worker.js`
if (legacy) await writeFile(fixture,"self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));")
const context=await chromium.launchPersistentContext(`${output}/browser-profile-${Date.now()}`,{channel:'chrome',headless:true,locale:'en-US',args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']})
await context.route('**/*',route=>new URL(route.request().url()).origin===siteOrigin?route.continue():route.abort())
const page=await context.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
try {
 await page.goto(`${siteOrigin}/`)
 await page.evaluate(async(legacy)=>{
  if (legacy) { await navigator.serviceWorker.register('/legacy-test-worker.js',{scope:'/'})
  await navigator.serviceWorker.ready }
  localStorage.setItem('atlas-language','en')
  localStorage.setItem('atlas-isolation-sentinel','preserve-me')
  const cache=await caches.open('atlas-preservation-test');await cache.put('/preservation-test',new Response('saved'))
 }, legacy)
 if (legacy) await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(r=>r.map(x=>x.scope)))).toContain(`${siteOrigin}/`)
 await page.reload()
 await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(r=>r.length))).toBe(0)
 await page.reload()
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller),null)
 assert.equal(await page.evaluate(()=>localStorage.getItem('atlas-isolation-sentinel')),'preserve-me')
 assert.equal(await page.evaluate(()=>caches.match('/preservation-test').then(r=>r.text())),'saved')
 await page.goto(`${appBase}/?lang=en#pokemon=6&scene=studio`)
 await page.locator('.live-dot:not(.loading)').waitFor({timeout:120000})
 await page.locator('.loader').waitFor({state:'hidden'})
 await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(r=>r.map(x=>x.scope))),{timeout:120000}).toEqual([`${siteOrigin}/atlas/`])
 await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL),{timeout:120000}).toBe(`${siteOrigin}/atlas/sw.js`)
 assert.equal(await page.locator('a[href="/"]').count(),0)
 const manifest=await page.evaluate(async()=>fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json()))
 assert.equal(manifest.id,'/atlas/')
 assert.equal(manifest.scope,'/atlas/')
 assert(new URL(manifest.start_url,siteOrigin).pathname.startsWith('/atlas/'))
 await page.reload()
 await page.locator('.live-dot:not(.loading)').waitFor({timeout:120000})
 await page.locator('.loader').waitFor({state:'hidden'})
 const cdp=await context.newCDPSession(page)
 const installation=await cdp.send('Page.getInstallabilityErrors')
 assert.equal(installation.installabilityErrors.length,0,JSON.stringify(installation))
 await context.setOffline(true)
 await page.reload()
 await page.locator('.live-dot:not(.loading)').waitFor({timeout:120000})
 await page.locator('.loader').waitFor({state:'hidden'})
 await context.setOffline(false)
 await page.goto(`${siteOrigin}/#pokemon=6`)
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller),null)
 assert.equal(await page.locator('link[rel=manifest]').count(),0)
 assert.equal(new URL(page.url()).pathname,'/')
 assert.equal(await page.evaluate(()=>localStorage.getItem('atlas-isolation-sentinel')),'preserve-me')
 assert.deepEqual(await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(r=>r.map(x=>x.scope))),[`${siteOrigin}/atlas/`])
 const rootCaches=await page.evaluate(async()=>{const found=[];for(const name of await caches.keys()){for(const request of await (await caches.open(name)).keys()){if(new URL(request.url).pathname==='/')found.push(name)}}return found})
 assert.deepEqual(rootCaches,[])
 assert.deepEqual(errors,[])
 await writeFile(`${output}/results.json`,JSON.stringify({legacyRegistrationRetired:legacy ? true : 'not exercised',storageAndCachePreserved:true,atlasOnlyScope:true,atlasInstallable:true,atlasOfflineModel:true,profileUncontrolled:true,rootNotCached:true,manifest,installation,errors},null,2))
 console.log('Root worker retired; data preserved; Atlas-only scope, installability and offline 3D passed.')
} finally {await context.close();if (legacy) await rm(fixture,{force:true})}
