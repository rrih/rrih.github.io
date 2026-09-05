import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argumentsList = process.argv.slice(2)
const option = (name, fallback) => argumentsList.includes(name) ? argumentsList[argumentsList.indexOf(name) + 1] : fallback
const port = Number(option('--port', '3334'))
const origin = `http://127.0.0.1:${port}`
const output = resolve(root, 'public/previews')
const recordDirectory = resolve(root, '../work/atlas-migration/previews')
mkdirSync(recordDirectory, { recursive: true })
mkdirSync(resolve(root, 'work'), { recursive: true })
mkdirSync(resolve(output, 'forms'), { recursive: true })
const catalog = JSON.parse(readFileSync(resolve(root, 'src/data/catalog.json'), 'utf8'))
const forms = JSON.parse(readFileSync(resolve(root, 'src/data/forms.json'), 'utf8'))
const models = JSON.parse(readFileSync(resolve(root, 'src/data/models.json'), 'utf8'))
const all = [...catalog.map((entry) => ({ key: String(entry.id), id: entry.id, name: entry.name, model: models[entry.id].url, file: `${entry.id}.webp` })), ...forms.map((form) => ({ key: form.id, id: form.speciesId, formId: form.id, name: form.name, model: form.model.url, file: `forms/${form.id}.webp` }))]
const requested = option('--ids', '').split(',').filter(Boolean)
const targets = requested.length ? requested.map((id) => { const entry = all.find((candidate) => candidate.key === id); assert(entry, `Unknown preview ${id}`); return entry }) : all
const harness = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><style>html,body,#root{margin:0;width:100%;height:100%;background:#101311;overflow:hidden}#root{position:relative}canvas{display:block}</style></head><body><div id="root"></div><script type="module">
import React,{useState,useRef} from 'react'; import {createRoot} from 'react-dom/client';
import Viewer from '/atlas/src/Viewer.tsx';import catalog from '/atlas/src/data/catalog.json';import {forms,modelFor,formPokemon} from '/atlas/src/forms.ts';
const settings={playing:true,rotate:false,speed:1,light:1,habitat:'studio',wireframe:false,shiny:false,quality:'high',animation:0};
const state={status:'loading',key:'6',loads:0};window.__atlasPreview={state};
function Preview(){const [target,setTarget]=useState({id:6});const viewer=useRef(); const pokemon=catalog.find(p=>p.id===target.id);const form=forms.find(f=>f.id===target.formId);const key=target.formId||String(target.id);
window.__atlasPreview.select=(next)=>{state.status='loading';state.key=next.formId||String(next.id);state.error='';setTarget(next)};
window.__atlasPreview.frame=()=>viewer.current?.view('reset');
return React.createElement(Viewer,{ref:viewer,pokemon:formPokemon(pokemon,form),label:form?.name||pokemon.name,model:modelFor(pokemon.id,form?.id),settings,onLoad:(clips)=>{state.status='ready';state.key=key;state.clips=clips.length;state.model=modelFor(pokemon.id,form?.id).url;state.loads++},onError:(error)=>{state.status='failed';state.error=error},onLoading:(loading)=>{if(loading)state.status='loading'}})}
createRoot(document.getElementById('root')).render(React.createElement(Preview));
</script></body></html>`
writeFileSync(resolve(root, 'work/preview.html'), harness)
let server, browser
const records = []
const rejected = [], errors = []
try {
  if (!argumentsList.includes('--existing-server') && !argumentsList.includes('--profile-only')) {
    const vite = [resolve(root, 'node_modules/vite/bin/vite.js'), resolve(root, '../node_modules/vite/bin/vite.js')].find(existsSync)
    assert(vite, 'Vite is required')
    server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let serverLog = ''
    server.stdout.on('data', (chunk) => { serverLog += chunk; writeFileSync(resolve(recordDirectory, 'vite.log'), serverLog) })
    server.stderr.on('data', (chunk) => { serverLog += chunk; writeFileSync(resolve(recordDirectory, 'vite.log'), serverLog) })
    for (let attempt = 0; attempt < 100; attempt++) { try { const response = await fetch(`${origin}/atlas/work/preview.html`); if (response.ok) break } catch {} if (server.exitCode !== null) throw new Error(`Vite stopped: ${serverLog}`); if (attempt === 99) throw new Error('Vite did not start'); await new Promise((resolve) => setTimeout(resolve, 100)) }
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1, locale: 'en-US', serviceWorkers: 'block' })
  await context.route('**/*', async (route) => { const url = new URL(route.request().url()); if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) await route.continue(); else { rejected.push(url.origin + url.pathname); await route.abort() } })
  const page = await context.newPage()
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message) })
  if (!argumentsList.includes('--skip-profile')) {
    const profile = await context.newPage()
    await profile.setViewportSize({ width: 1200, height: 630 })
    await profile.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{width:1200px;height:630px;margin:0;background:#f5f4ef;color:#20241f;font-family:Arial,Helvetica,sans-serif;padding:66px 80px;overflow:hidden}.top{display:flex;justify-content:space-between;font-size:18px;letter-spacing:3px;text-transform:uppercase;color:#667260}.name{font-size:170px;line-height:1;margin:74px 0 20px;letter-spacing:-12px;font-weight:600}.name span{color:#809463}.bio{font-size:25px;color:#65705f;margin:0}.bottom{display:flex;gap:44px;margin-top:66px;padding-top:25px;border-top:1px solid #cdd1c5;font-size:19px}.mark{position:absolute;right:78px;top:182px;width:205px;height:205px;border:1px solid #d1d7c7;border-radius:50%}.mark:before{content:'';position:absolute;inset:24px;border:1px solid #b9c8a5;border-radius:50%}.mark:after{content:'';position:absolute;inset:48px;border-radius:50%;background:#dbe5cc}</style></head><body><div class="top"><span>PHP Developer</span><span>rrih.github.io</span></div><h1 class="name">rrih<span>.</span></h1><p class="bio">Maintainer of orimemo.com</p><div class="mark"></div><div class="bottom"><span>Pokémon Atlas</span><span>orimemo</span><span>Emoji Overlay</span></div></body></html>`)
    await profile.screenshot({ path: resolve(root, '../profile-card.png'), type: 'png' }); await profile.close()
    console.log(JSON.stringify({ profileCard: '../profile-card.png', width: 1200, height: 630 }))
  }
  if (!argumentsList.includes('--profile-only')) {
  const start = Date.now()
  await page.goto(`${origin}/atlas/work/preview.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__atlasPreview?.state.status === 'ready' || window.__atlasPreview?.state.status === 'failed', undefined, { timeout: 120_000 })
  const initial = await page.evaluate(() => window.__atlasPreview.state)
  assert.equal(initial.status, 'ready', initial.error)
  for (const [index, target] of targets.entries()) {
    const file = resolve(output, target.file)
    const sourceHash = createHash('sha256').update(readFileSync(resolve(root, 'public', target.model.slice(1)))).digest('hex')
    const recordFile = resolve(recordDirectory, target.key + '.json')
    if (argumentsList.includes('--resume') && existsSync(file) && existsSync(recordFile)) {
      const previous = JSON.parse(readFileSync(recordFile, 'utf8'))
      if (previous.sourceHash === sourceHash && previous.success) { records.push(previous); continue }
    }
    const began = Date.now()
    const selected = await page.evaluate(() => window.__atlasPreview.state.key)
    if (selected !== target.key) await page.evaluate((target) => window.__atlasPreview.select({ id: target.id, formId: target.formId }), target)
    await page.waitForFunction((key) => window.__atlasPreview.state.key === key && ['ready', 'failed'].includes(window.__atlasPreview.state.status), target.key, { timeout: 120_000 })
    const state = await page.evaluate(() => window.__atlasPreview.state)
    assert.equal(state.status, 'ready', `${target.key}: ${state.error}`)
    assert.equal(state.model.replace(/^\/atlas\//, '/'), target.model, `${target.key}: actual source model`)
    await page.evaluate(() => window.__atlasPreview.frame())
    await page.waitForTimeout(220)
    const captured = await page.evaluate(async () => {
      await new Promise(requestAnimationFrame)
      const canvas = document.querySelector('canvas')
      const dataURL = canvas.toDataURL('image/webp', .84)
      const image = new Image(); image.src = dataURL; await image.decode()
      const check = document.createElement('canvas'); check.width = 64; check.height = 64
      const ctx = check.getContext('2d'); ctx.drawImage(image, 0, 0, 64, 64)
      const pixels = ctx.getImageData(0, 0, 64, 64).data
      let sum = 0, squared = 0; const colors = new Set()
      for (let i = 0; i < pixels.length; i += 4) { const value = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3; sum += value; squared += value * value; colors.add(`${pixels[i] >> 3},${pixels[i + 1] >> 3},${pixels[i + 2] >> 3}`) }
      const n = pixels.length / 4
      return { dataURL, width: canvas.width, height: canvas.height, variance: squared / n - (sum / n) ** 2, colors: colors.size }
    })
    assert(captured.dataURL.startsWith('data:image/webp;base64,'), `${target.key}: WebP encoding`)
    assert.equal(captured.width, 512); assert.equal(captured.height, 512)
    assert(captured.variance > 15 && captured.colors > 30, `${target.key}: blank capture ${JSON.stringify({ variance: captured.variance, colors: captured.colors })}`)
    const bytes = Buffer.from(captured.dataURL.split(',')[1], 'base64')
    const imageHash = createHash('sha256').update(bytes).digest('hex')
    assert(!records.some((record) => record.imageHash === imageHash), `${target.key}: duplicate image of an earlier model`)
    writeFileSync(file, bytes)
    const record = { key: target.key, speciesId: target.id, formId: target.formId, name: target.name, model: target.model, sourceHash, path: `/atlas/previews/${target.file}`, imageHash, width: captured.width, height: captured.height, bytes: bytes.length, variance: captured.variance, colors: captured.colors, recordedAnimations: state.clips, elapsedMs: Date.now() - began, success: true }
    records.push(record); writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n')
    if (index < 3 || (index + 1) % 20 === 0 || index + 1 === targets.length) console.log(JSON.stringify({ complete: records.length, targets: targets.length, key: target.key, elapsedMs: record.elapsedMs, bytes: record.bytes, totalMs: Date.now() - start }))
  }
  if (!requested.length && records.length === all.length) writeFileSync(resolve(root, 'src/data/previews.json'), JSON.stringify({ species: catalog.map((entry) => entry.id), forms: forms.map((form) => form.id) }) + '\n')
  const summary = { success: records.length === targets.length, requested: targets.length, completed: records.length, totalMs: Date.now() - start, bytes: records.reduce((sum, record) => sum + record.bytes, 0), externalRequestsBlocked: rejected, errors, records }
  writeFileSync(resolve(recordDirectory, requested.length ? 'sample-summary.json' : 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(JSON.stringify({ complete: summary.completed, totalMs: summary.totalMs, bytes: summary.bytes, errors }))
  }
} finally {
  await browser?.close()
  if (server) server.kill('SIGTERM')
}
