import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, siteOrigin } from './helpers.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const build = resolve(root, process.env.ATLAS_RENDERER_BROWSER_QA || 'work/rust-renderer-qa/browser')
const output = resolve(root, process.env.ATLAS_QA_DIR || 'work/rust-renderer-qa/browser-evidence')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, acceptDownloads: true })
await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }))
await context.route(`${siteOrigin}/renderer-qa/**`, async route => {
  const name = new URL(route.request().url()).pathname.split('/').pop()
  if (!name) return route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#viewer-qa{position:relative;width:100vw;height:100vh}</style><div id="viewer-qa"></div><script type="module">import * as qa from "./atlas_app.js";await qa.default({module_or_path:"./atlas_app_bg.wasm"});window.qa=qa;</script>'})
  return route.fulfill({body:await readFile(resolve(build,name)),contentType:name.endsWith('.wasm')?'application/wasm':'text/javascript'})
})
const page = await context.newPage(), errors = [], consoleErrors = [], results = []
let gpu, expectedBaselineLimitations = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if(message.type()==='error') consoleErrors.push(message.text()) })
// Original JS reproduction: work/rust-migration/baseline/shader-errors.json.
// Three r180 assumes a 64 KiB instance UBO; this forced WebGL backend exposes
// only 16 KiB. Permit this exact existing limitation, never other shader errors.
const baselineUniformLimit = /^THREE\.WebGLProgram: Shader Error (?:0|1282) - VALIDATE_STATUS false\n\nProgram Info Log: Size of uniform block NodeBuffer_\d+ in VERTEX shader exceeds GL_MAX_UNIFORM_BLOCK_SIZE \(16384\)\n\n$/
const checkGraphicsErrors = async () => {
  gpu ??= await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2'), debug = gl?.getExtension('WEBGL_debug_renderer_info')
    return { backend: gl ? 'webgl2' : null, maxUniformBlockSize: gl?.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) }
  })
  const known = message => gpu.backend === 'webgl2' && gpu.maxUniformBlockSize === 16384 && baselineUniformLimit.test(message)
  assert.deepEqual(consoleErrors.filter(message => !known(message)), [], 'No new console or shader errors are allowed')
  expectedBaselineLimitations = consoleErrors.filter(known)
}
const settings = { playing:true, rotate:false, speed:1, light:1, habitat:'studio', wireframe:false, shiny:false, quality:'standard', animation:0 }
const ready = async () => {
  await page.waitForFunction(() => document.body.dataset.loading === 'false' || document.body.dataset.error, null, {timeout:120000})
  assert.equal(await page.locator('body').getAttribute('data-error'),'')
  await page.locator('canvas').waitFor()
  await page.waitForTimeout(450)
}
const mount = async (id, form, next=settings, members) => {
  await page.evaluate(({id,form,next,members})=>{document.body.dataset.loading='true';window.qa.renderer_qa_mount(id,form,JSON.stringify(next),members&&JSON.stringify(members))},{id,form,next,members})
  await ready()
}
const update = async next => {await page.evaluate(next=>window.qa.renderer_qa_settings(JSON.stringify(next)),next);await page.waitForTimeout(450)}
try {
  await page.goto(`${siteOrigin}/renderer-qa/`)
  await page.waitForFunction(()=>!!window.qa)
  await mount(6)
  await checkGraphicsErrors()
  assert((JSON.parse(await page.locator('body').getAttribute('data-animations'))).length>0)
  const moving=await page.locator('canvas').screenshot();await page.waitForTimeout(250)
  assert(!moving.equals(await page.locator('canvas').screenshot()),'Recorded model animation changes actual pixels')
  await update({...settings,playing:false})
  const paused=await page.locator('canvas').screenshot();await page.waitForTimeout(250)
  assert(paused.equals(await page.locator('canvas').screenshot()),'Paused model has stable pixels')
  await page.evaluate(()=>window.qa.renderer_qa_view('side'));await page.waitForTimeout(500)
  assert(!paused.equals(await page.locator('canvas').screenshot()),'Camera controls change pixels')
  const pose=await page.evaluate(()=>JSON.parse(window.qa.renderer_qa_camera()));assert.equal(pose.position.length,3)
  const download=page.waitForEvent('download');await page.evaluate(()=>window.qa.renderer_qa_capture());await(await download).saveAs(`${output}/capture.png`)
  results.push('animation-pause-camera-capture')
  for(const habitat of ['forest','coast','snow','desert','meadow','mountain','cave','underwater','volcano','wetland','sakura','night']){
    await update({...settings,playing:false,habitat});await page.screenshot({path:`${output}/${habitat}.png`});assert.deepEqual(errors,[]);await checkGraphicsErrors();results.push(habitat)
  }
  await mount(25,undefined,{...settings,playing:false});await page.screenshot({path:`${output}/pikachu.png`});results.push('pikachu-model-switch')
  await mount(6,'charizard-mega-x',{...settings,playing:false,shiny:true});await page.screenshot({path:`${output}/mega-shiny.png`});results.push('mega-shiny')
  const members=[6,1,25,133,7,94].map((speciesId,i)=>({key:`test-${i}`,speciesId,shiny:false,x:(i%3-1)*2.6,z:i<3?-1.4:1.4,rotation:0,scale:0.8}))
  await mount(6,undefined,{...settings,playing:false},members);await page.screenshot({path:`${output}/six-members.png`});results.push('six-members')
  await page.setViewportSize({width:320,height:568});await page.waitForTimeout(500);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${output}/mobile320.png`});results.push('resize320')
  await checkGraphicsErrors()
  await page.evaluate(()=>window.qa.renderer_qa_dispose());await page.locator('canvas').waitFor({state:'detached'});results.push('lifecycle-dispose')
  assert.deepEqual(errors,[])
  await checkGraphicsErrors()
  await writeFile(`${output}/results.json`,JSON.stringify({passed:true,results,errors,gpu,expectedBaselineLimitations},null,2))
  console.log('Rust renderer: real pixels, recorded animation, pause, camera, capture, 12 habitats, model/form/shiny switching, six members, resize and disposal passed.')
  if(expectedBaselineLimitations.length) console.warn(`${expectedBaselineLimitations.length} exact original-JS uniform-block errors remain on this 16 KiB WebGL backend; this does not certify that every landscape instance rendered.`)
}catch(error){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});await writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),stack:error.stack,errors,consoleErrors,gpu,expectedBaselineLimitations,results,body:await page.locator('body').getAttribute('data-error')},null,2));throw error}finally{await browser.close()}
