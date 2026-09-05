import { appBase } from './helpers.mjs'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {chromium} from './helpers.mjs'
const base=appBase
const output=process.env.ATLAS_QA_DIR || 'work/expansion/qa'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']})
const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'})
const page=await context.newPage()
const errors=[]
const requests=[]
page.on('pageerror',error=>errors.push(error.message))
page.on('request',request=>requests.push(request.url()))
if(process.env.ATLAS_FORCE_WEBGL==='1') await context.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined})})
const ready=async()=>{await page.locator('.live-dot:not(.loading)').waitFor({timeout:120000});await page.locator('.loader').waitFor({state:'hidden'});assert.equal(await page.locator('.viewer-error').count(),0)}
const canvas=()=>page.locator('canvas')
const shot=async name=>{console.log('Verified',name);await canvas().scrollIntoViewIfNeeded();await page.waitForTimeout(400);await page.screenshot({path:`${output}/${name}.png`,fullPage:true})}
const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow')
const modelRequests=()=>requests.filter(url=>url.includes('/models/') && url.endsWith('.glb'))
const selectForm=async value=>{await page.getByRole('combobox',{name:'Form',exact:true}).selectOption(value);await ready()}
try {
 await page.goto(`${base}/ja/pokemon/753/`);await page.locator('h1').filter({hasText:'カリキリ'}).waitFor({timeout:30000});await ready();assert.equal(await page.locator('h1').innerText(),'カリキリ')
 assert.equal(await page.locator('.title-dot').count(),0)
 assert(!await page.getByText('細部も、自分好みに。',{exact:true}).count())
 await page.goto(`${base}/pokemon/6/?lang=en`);await ready();await noOverflow()
 await selectForm('charizard-mega-x');assert.equal(await page.locator('h1').innerText(),'Mega Charizard X')
 assert((await page.locator('.type-row').innerText()).includes('Dragon'))
 assert((await page.locator('.measurements').innerText()).includes('110.5'))
 await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(700)
 let before=await canvas().screenshot();await page.waitForTimeout(600);assert(!before.equals(await canvas().screenshot()),'Mega has source motion')
 await page.locator('.detail-tabs').getByRole('button',{name:'Studio',exact:true}).click()
 await page.getByRole('button',{name:'Shiny appearance',exact:true}).click();await ready();await page.waitForTimeout(500)
 before=await canvas().screenshot();await page.waitForTimeout(600);assert(!before.equals(await canvas().screenshot()),'Mega shiny keeps source motion')
 await page.getByRole('button',{name:'Pause animation',exact:true}).click();await shot('mega-charizard-x-shiny')
 await selectForm('charizard-mega-y');await shot('mega-charizard-y')
 const external=JSON.parse(await readFile('scripts/data/form-external-sources.json','utf8'))
 const variants=[[26,'raichu-alola'],[110,'weezing-galar'],[157,'typhlosion-hisui'],[570,'zorua-hisui'],[571,'zoroark-hisui'],[628,'braviary-hisui'],[128,'tauros-paldea-blaze-breed'],[128,'tauros-paldea-aqua-breed'],[555,'darmanitan-galar-zen'],[445,'garchomp-mega-z'],[448,'lucario-mega-z'],[658,'greninja-mega'],[670,'floette-mega']]
 for(const item of external) if(!variants.some(([,form])=>form===item.id)) variants.push([item.speciesId,item.id])
 for(const [id,form] of variants){await page.goto(`${base}/pokemon/${id}/?lang=en#pokemon=${id}&form=${form}&scene=studio`);await ready();assert.equal(await page.getByRole('combobox',{name:'Form',exact:true}).inputValue(),form);await shot(form)}
 await page.goto(`${base}/pokemon/25/?lang=en`);await ready()
 const scenes=['studio','forest','night','coast','snow','desert','meadow','mountain','cave','underwater','volcano','wetland','sakura']
 for(const scene of scenes){await page.locator(`.environment-card.${scene}`).click();await canvas().scrollIntoViewIfNeeded();await page.waitForTimeout(400);assert.equal(await page.locator(`.viewer-stage.${scene}`).count(),1);await shot(`environment-${scene}`);const front=await canvas().screenshot();await page.getByRole('button',{name:'back',exact:true}).click();await page.waitForTimeout(400);assert(!front.equals(await canvas().screenshot()),`${scene}: orbit changes real geometry`);await page.getByRole('button',{name:'Reset camera',exact:true}).click()}
 const upload=page.locator('.background-picker input[type=file]')
 await upload.setInputFiles({name:'private-location-123.jpg',mimeType:'image/jpeg',buffer:await readFile('public/social.jpg')});await page.locator('.viewer-stage.custom').waitFor();await page.waitForTimeout(700);await shot('custom-background')
 assert(!requests.some(url=>url.includes('private-location-123')),'image filename never leaves device')
 await page.reload();await ready();await page.locator('.viewer-stage.custom').waitFor();await shot('custom-reloaded')
 await page.getByRole('button',{name:'Together',exact:true}).click();await ready()
 await page.getByRole('textbox',{name:'Scene name',exact:true}).fill('Private photo studio')
 await page.getByRole('button',{name:'Save scene',exact:true}).click();await page.getByText('Scene saved on this device.',{exact:true}).waitFor()
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download scene',exact:true}).first().click();const file=await download;await file.saveAs(`${output}/scene.json`)
 const exported=JSON.parse(await readFile(`${output}/scene.json`,'utf8'));assert(exported.background.startsWith('data:image/'));assert.equal(exported.scene.settings.habitat,'custom');assert(!JSON.stringify(exported).includes('private-location-123'))
 await page.getByRole('button',{name:'Remove background image',exact:true}).click();assert.equal(await page.locator('.viewer-stage.custom').count(),0)
 await page.locator('.scene-file-actions input[type=file]').setInputFiles(`${output}/scene.json`);await page.getByText('Scene imported.',{exact:true}).waitFor();await ready();await page.locator('.viewer-stage.custom').waitFor();await shot('custom-imported')
 const old=await page.getByRole('textbox',{name:'Scene name',exact:true}).inputValue()
 await page.locator('.scene-file-actions input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,background:'https://example.com/private.jpg'}))});await page.getByText('This scene file could not be opened.',{exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Scene name',exact:true}).inputValue(),old)
 await upload.setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')});await page.getByText('This image could not be opened. Use JPEG, PNG, WebP, GIF or AVIF.',{exact:true}).waitFor();assert.equal(await page.locator('.viewer-stage.custom').count(),1)
 const beforeLayout=modelRequests().length;await page.getByRole('slider',{name:'Left / right',exact:true}).fill('2');await page.waitForTimeout(200);assert.equal(modelRequests().length,beforeLayout,'placement does not refetch models')
 await page.setViewportSize({width:390,height:844});await noOverflow();await shot('mobile390-custom')
 await page.setViewportSize({width:320,height:568});await noOverflow();await shot('mobile320-custom')
 await page.getByRole('button',{name:'Save scene',exact:true}).click();await page.getByText('Scene saved on this device.',{exact:true}).waitFor()
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:45000})
 await context.setOffline(true);await page.reload();await ready();await page.locator('.viewer-stage.custom').waitFor();await shot('offline-custom')
 assert.deepEqual(errors,[])
 const result={base,mega:true,megaShinyMotion:true,regionalExamples:variants.length,environments:scenes.length,customUpload:true,customReload:true,customExportImport:true,invalidImagesRejected:true,invalidImportPreservesScene:true,noFilenameRequests:true,placementNoReload:true,mobile390:true,mobile320:true,offlineCustom:true,errors}
 await writeFile(`${output}/results.json`,JSON.stringify(result,null,2));console.log(result)
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${output}/failure.txt`,String(error)+'\n'+errors.join('\n')+'\n'+await page.locator('body').innerText());throw error}finally{await browser.close()}
