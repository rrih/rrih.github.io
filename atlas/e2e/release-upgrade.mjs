import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from './helpers.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const previous = resolve(root, process.env.ATLAS_PREVIOUS_DIST || 'work/rust-migration/baseline/site-dist')
const current = resolve(root, process.env.ATLAS_DIST || 'site-dist')
const output = resolve(root, process.env.ATLAS_QA_DIR || 'work/rust-migration/release-upgrade')
const words = JSON.parse(await readFile(new URL('../src/locales/ui/ja.json', import.meta.url)))
for (const dist of [previous, current]) await access(`${dist}/atlas/sw.js`)
const hash = value => createHash('sha256').update(value).digest('hex')
const oldWorkerHash = hash(await readFile(`${previous}/atlas/sw.js`))
const newWorkerHash = hash(await readFile(`${current}/atlas/sw.js`))
assert.notEqual(newWorkerHash, oldWorkerHash, 'This test requires two distinct real release workers')
await mkdir(output, { recursive: true })
let active = previous
let networkEnabled = true
const offlineNetworkRequests=[]
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.wasm':'application/wasm', '.glb':'model/gltf-binary', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' }
const server = createServer(async (request, response) => {
  // Also close the service worker's network path, beyond page-level emulation.
  if(!networkEnabled){offlineNetworkRequests.push(request.url);request.socket.destroy();return}
  try {
    const url = new URL(request.url,'http://localhost')
    if(url.pathname==='/tools/upgrade-sentinel/sw.js'){
      response.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'}).end("self.addEventListener('install',()=>self.skipWaiting())")
      return
    }
    let filename=resolve(active,`.${decodeURIComponent(url.pathname)}`)
    if(filename!==active&&!filename.startsWith(`${active}${sep}`)){response.writeHead(403).end();return}
    let info=await stat(filename).catch(()=>null)
    if(info?.isDirectory()){
      if(!url.pathname.endsWith('/')){response.writeHead(301,{Location:`${url.pathname}/${url.search}`}).end();return}
      filename=resolve(filename,'index.html');info=await stat(filename).catch(()=>null)
    }
    const found=info?.isFile()
    if(!found){filename=resolve(active,'404.html');info=await stat(filename)}
    response.writeHead(found?200:404,{'Content-Type':mime[extname(filename)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'})
    if(request.method==='HEAD')response.end()
    else createReadStream(filename).on('error',()=>response.destroy()).pipe(response)
  }catch(error){response.writeHead(error instanceof URIError?400:500).end(String(error))}
})
await new Promise((ready,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ready)})
const origin=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']})
const context=await browser.newContext({viewport:{width:1280,height:900},locale:'en-US',reducedMotion:'reduce',acceptDownloads:true})
const page=await context.newPage(),errors=[],requests=[],lifecycle=[]
page.on('pageerror',error=>errors.push(error.message))
page.on('request',request=>requests.push({url:request.url(),release:active===previous?'previous':'current'}))
await page.exposeBinding('__upgradeLifecycle',(_source,event)=>lifecycle.push(event))
await page.addInitScript(()=>{
  window.__upgradeDocument=crypto.randomUUID()
  window.__upgradeLifecycle({kind:'document',id:window.__upgradeDocument,url:location.href,scene:localStorage.getItem('atlas-scenes-v1')})
  navigator.serviceWorker.addEventListener('controllerchange',()=>window.__upgradeLifecycle({kind:'controllerchange',id:window.__upgradeDocument}))
})
const ready=async()=>{
  await page.locator('.app-shell[data-catalog-state=ready]').waitFor({timeout:120000})
  await page.locator('.live-dot:not(.loading)').waitFor({timeout:120000})
  await page.locator('.loader').waitFor({state:'hidden'})
  assert.equal(await page.locator('.viewer-error').count(),0)
}
let modelLocations=[]
const snapshot=()=>page.evaluate(async locations=>{
  const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('')
  const local=Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('atlas')||k==='other:upgrade-sentinel').sort().map(k=>[k,localStorage.getItem(k)]))
  const state=JSON.parse(localStorage.getItem('atlas-scenes-v1'))
  // JSON member order and number formatting are not user data; compare the full
  // parsed scene below while retaining exact strings for other storage keys.
  delete local['atlas-scenes-v1']
  const images=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('atlas-backgrounds-v1',1)
    request.onerror=()=>reject(request.error)
    request.onsuccess=()=>{const db=request.result,transaction=db.transaction('images','readonly'),read=transaction.objectStore('images').getAll();read.onsuccess=()=>{resolve(read.result);db.close()};read.onerror=()=>{reject(read.error);db.close()}}
  })
  const backgrounds=await Promise.all(images.map(async x=>({id:x.id,version:x.version,width:x.width,height:x.height,type:x.blob.type,bytes:x.blob.size,sha256:await digest(x.blob)})))
  const models=[]
  for(const location of locations){
    let response
    if(location.id===6){
      // Precache generations/revision query strings may change on a real release.
      // Its unchanged public model URL and bytes must still be present offline.
      for(const name of await caches.keys()){
        if(!name.startsWith('workbox-precache-'))continue
        response=await(await caches.open(name)).match('/atlas/models/home/6.glb',{ignoreSearch:true})
        if(response)break
      }
    }else response=await(await caches.open(location.cache)).match(location.key)
    if(!response)throw Error(`Missing old model cache key ${location.cache}: ${location.key}`)
    const identity=location.id===6?{id:6,path:'/atlas/models/home/6.glb',cacheClass:'precache'}:location
    const blob=await response.blob();models.push({...identity,bytes:blob.size,sha256:await digest(blob)})
  }
  return {local,state,backgrounds:backgrounds.sort((a,b)=>a.id.localeCompare(b.id)),models,otherCache:await(await(await caches.open('other-upgrade-sentinel')).match('/upgrade-sentinel')).text(),registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname).sort()}
},modelLocations)
const evidence={previous,current,oldWorkerHash,newWorkerHash,origin,lifecycle,offlineNetworkRequests}
try{
  await page.goto(`${origin}/atlas/?lang=en#pokemon=6&scene=studio`)
  await ready()
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:120000}).toBe(true)
  const installedAt=Date.now()
  await page.getByRole('button',{name:'Save Charizard',exact:true}).click()
  await page.getByRole('button',{name:'Together',exact:true}).click()
  await ready()
  const background=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=96;c.height=64;const x=c.getContext('2d');x.fillStyle='#8fc3d1';x.fillRect(0,0,96,64);x.fillStyle='#456b4e';x.fillRect(0,40,96,24);return c.toDataURL('image/png')})
  const scene={id:'release-upgrade',name:'Saved before Rust migration',members:[6,1,25,133,7,94].map((speciesId,i)=>({key:`upgrade-${i}`,speciesId,shiny:false,x:(i%3-1)*2.6,z:i<3?-1.4:1.4,rotation:i*15,scale:0.8})),settings:{playing:false,rotate:false,speed:1.25,light:1.1,habitat:'custom',wireframe:false,shiny:false,quality:'standard',animation:0},camera:{position:[8,7,13],target:[0,1,0]}}
  await page.locator('.scene-file-actions input[type=file]').setInputFiles({name:'upgrade.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,scene,background}))})
  await page.getByText('Scene imported.',{exact:true}).waitFor()
  await ready()
  await page.getByRole('button',{name:'Save scene',exact:true}).click()
  await page.getByText('Scene saved on this device.',{exact:true}).waitFor()
  await page.locator('.language-button').click()
  await page.locator('[data-language="ja"]').click()
  await page.locator('.app-shell[data-locale=ja][data-catalog-state=ready]').waitFor({timeout:120000})
  await ready()
  // Finish the old UI choices before the final save. The old viewer can reframe
  // after a resize without synchronizing its stored camera until pagehide.
  await page.getByRole('button',{name:words['Save scene'],exact:true}).click()
  await page.getByText(words['Scene saved on this device.'],{exact:true}).waitFor()
  await page.evaluate(async()=>{
    localStorage.setItem('atlas-upgrade-sentinel','preserve-unknown-atlas-key')
    localStorage.setItem('other:upgrade-sentinel','preserve-unrelated-key')
    await(await caches.open('other-upgrade-sentinel')).put('/upgrade-sentinel',new Response('preserve-unrelated-cache'))
    await navigator.serviceWorker.register('/tools/upgrade-sentinel/sw.js',{scope:'/tools/upgrade-sentinel/'})
  })
  // The old release precaches the default Charizard before its runtime route.
  // Record that real revisioned key and the other five canonical runtime keys.
  // Runtime namespaces/keys and all six models' bytes must survive the update.
  await expect.poll(async()=>{
    modelLocations=await page.evaluate(async()=>{
      const locations=[]
      for(const name of await caches.keys()){
        if(!name.startsWith('workbox-precache-'))continue
        for(const request of await(await caches.open(name)).keys()){
          if(new URL(request.url).pathname==='/atlas/models/home/6.glb')locations.push({id:6,cache:name,key:request.url})
        }
      }
      if(locations.length!==1)return []
      const cache=await caches.open('atlas-models-v1')
      for(const id of [1,25,133,7,94]){
        const key=new URL(`/models/home/${id}.glb`,location.origin).href
        if(await cache.match(key))locations.push({id,cache:'atlas-models-v1',key})
      }
      return locations
    })
    return modelLocations.length
  },{timeout:120000}).toBe(6)
  evidence.previousModelCacheLocations=modelLocations
  evidence.previousUrl=page.url()
  evidence.before=await snapshot()
  assert.equal(evidence.before.local['atlas-language'],'ja')
  assert.deepEqual(JSON.parse(evidence.before.local['atlas-favorites']),[6])
  assert.equal(evidence.before.state.active,true)
  assert.equal(evidence.before.state.draft.name,scene.name)
  assert.deepEqual(evidence.before.state.draft.members,scene.members,'The old UI must preserve all six private member identities and placements before migration')
  for(const [key,value] of Object.entries(scene.settings))assert.equal(evidence.before.state.draft.settings[key],value)
  assert(evidence.before.state.draft.camera,'The old UI must store a camera before migration')
  assert.equal(evidence.before.state.saved.length,1)
  assert.equal(evidence.before.state.saved[0].name,scene.name)
  assert.deepEqual(evidence.before.state.saved[0].members,scene.members)
  assert.equal(evidence.before.backgrounds.length,1)
  assert.equal(evidence.before.state.draft.settings.backgroundId,evidence.before.backgrounds[0].id)
  assert.equal(evidence.before.state.saved[0].settings.backgroundId,evidence.before.backgrounds[0].id)
  // A fullPage capture changes the old viewer's framing and leaves its URL stale.
  // Capture the viewport so evidence collection cannot mutate the migration input.
  await page.screenshot({path:`${output}/previous-release.png`})
  // Workbox distinguishes an update from the initial install after its first minute.
  for(let remaining=62000-(Date.now()-installedAt);remaining>0;remaining=62000-(Date.now()-installedAt)){
    console.log(`Previous release state saved; ${Math.ceil(remaining/1000)} seconds remain before checking a real update.`)
    await new Promise(resolve=>setTimeout(resolve,Math.min(remaining,30000)))
  }
  active=current
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration('/atlas/');await registration.update()})
  await page.getByRole('button',{name:words['Update now'],exact:true}).waitFor({timeout:120000})
  assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration('/atlas/')).waiting?.state),'installed')
  evidence.waitingStatePreserved=await snapshot()
  evidence.waitingUrl=page.url()
  assert.deepEqual(evidence.waitingStatePreserved,evidence.before)
  const oldDocument=await page.evaluate(()=>window.__upgradeDocument)
  const documentCount=lifecycle.filter(x=>x.kind==='document').length
  networkEnabled=false
  await context.setOffline(true)
  assert(await page.evaluate(async()=>{try{await fetch(`/uncached-upgrade-proof-${Date.now()}`,{cache:'no-store'});return false}catch{return true}}))
  await Promise.all([page.waitForEvent('domcontentloaded',{timeout:120000}),page.getByRole('button',{name:words['Update now'],exact:true}).click()])
  await ready()
  await page.locator('.app-shell[data-locale=ja]').waitFor()
  assert.notEqual(await page.evaluate(()=>window.__upgradeDocument),oldDocument)
  const currentDocument=await page.evaluate(()=>window.__upgradeDocument)
  await expect.poll(()=>lifecycle.find(event=>event.kind==='document'&&event.id===currentDocument)).toBeTruthy()
  const startup=lifecycle.find(event=>event.kind==='document'&&event.id===currentDocument)
  assert.deepEqual(JSON.parse(startup.scene),evidence.before.state,'The old page must not mutate the saved scene during pagehide before Rust starts')
  evidence.after=await snapshot()
  assert.deepEqual(evidence.after,evidence.before,'The real release update must retain favorites, language, exact scene state, original image bytes, old cache keys, unrelated data and worker scopes')
  assert(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>new URL(r.name).pathname.endsWith('.wasm')&&!new URL(r.name).pathname.includes('/draco/'))),'The reloaded page must execute the Rust WASM application, not an old cached JS release')
  await page.reload()
  await ready()
  assert.deepEqual(await snapshot(),evidence.before,'A second offline cold navigation preserves and restores the migrated scene')
  evidence.rustOfflineReload=true
  await page.screenshot({path:`${output}/rust-release-offline.png`,fullPage:true})
  evidence.updateReloads=lifecycle.filter(x=>x.kind==='document').length-documentCount-1
  assert.equal(evidence.updateReloads,1,'Exactly one automatic reload occurs during the update')
  networkEnabled=true
  await context.setOffline(false)
  await page.goto(`${origin}/`)
  assert.equal(await page.locator('h1').innerText(),'rrih')
  assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller),null)
  assert.equal(await page.locator('canvas').count(),0)
  evidence.profileIndependent=true
  assert.deepEqual(errors,[])
  await writeFile(`${output}/verification.json`,JSON.stringify({...evidence,errors,passed:true},null,2))
  console.log('Previous JS release → Rust release: public PWA update, offline WASM/3D, favorite/language/six-member scene/photo bytes/cache keys and unrelated storage/scopes preserved.')
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${output}/failure.json`,JSON.stringify({...evidence,error:String(error),stack:error.stack,errors,requests},null,2));throw error}finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done))}
