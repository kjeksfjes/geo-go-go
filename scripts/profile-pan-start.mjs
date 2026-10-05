// Diagnostic only: native pointer-to-transform timing, no screenshot or visible-paint verification.
// Supply PLAYWRIGHT_PACKAGE and BROWSER_EXECUTABLE for an existing installation.
import {createRequire} from 'node:module'
import {writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {})})
const url=process.env.PAN_START_URL || 'http://127.0.0.1:4178/'
if (!['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw Error('Use a local preview or development server')
const bathymetry=process.env.PAN_START_BATHYMETRY === '1'
const renderer=process.env.PAN_START_RENDERER || 'canvas'
const runs=[]
try {
 for(const detail of [false,true])for(const original of [true,false]) {
  if (process.env.PAN_START_POLICY === 'candidate' && original) continue
  const context=await browser.newContext({viewport:{width:Number(process.env.PAN_START_WIDTH || 1200),height:900},deviceScaleFactor:Number(process.env.PAN_START_DPR || 1)}),page=await context.newPage()
  await page.addInitScript(bathymetry=>{localStorage.setItem('geo-go-go.locale','en');localStorage.setItem('geo-go-go.map.bathymetry',String(bathymetry));localStorage.setItem('geo-go-go.map.relief','false')},bathymetry)
  await page.goto(url + (renderer === 'svg' ? '?renderer=svg' : ''))
  await page.waitForSelector(renderer === 'svg' ? 'path.country' : '.world-map--canvas')
  if (bathymetry) await page.waitForFunction(()=>document.querySelector('.world-map--bathymetry'))
  await page.addStyleTag({content: original ? '.world-map--canvas .country.country--hit-only {vector-effect:non-scaling-stroke !important}' : '.world-map--canvas .country--hit-only:not(:focus-visible) {vector-effect:none !important}'})
  if(detail){await page.getByRole('button',{name:'Map settings',exact:true}).click();await page.getByRole('switch',{name:'High detail',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.map-stage--busy')&&!document.querySelector('[role=switch][aria-busy=true]'));await page.getByRole('button',{name:'Map settings',exact:true}).click()}
  await page.waitForTimeout(1500)
  await page.evaluate(()=>{
   const svg=document.querySelector('.world-map'), group=document.querySelector('.map-content')
   window.__panStart=null
   window.__panFallbacks=[]
   new MutationObserver(()=>{const run=window.__panStart;if(run)run.rendererStates.push({at:performance.now(),canvas:svg.classList.contains('world-map--canvas')})}).observe(svg,{attributes:true,attributeFilter:['class']})
   for(const type of ['pointerdown','pointermove']){
    window.addEventListener(type,event=>{const run=window.__panStart;if(!run)return;run.events.push({type,start:performance.now(),x:event.clientX})},true)
    window.addEventListener(type,()=>{const run=window.__panStart;if(!run)return;const event=run.events.at(-1);if(event)event.handlerEnd=performance.now()})
   }
   new MutationObserver(records=>{const run=window.__panStart;if(!run||run.transform)return;if(records.some(r=>r.attributeName==='transform')){run.transform=performance.now();requestAnimationFrame(()=>{if(window.__panStart===run)run.nextRAF=performance.now()})}}).observe(group,{attributes:true})
  })
  for(const target of ['CAN','DZA','ocean'])for(let trial=0;trial<Number(process.env.PAN_START_REPEATS || 6);trial++) {
   const reset=page.getByRole('button',{name:'Reset view',exact:true});if(await reset.count()){await reset.click();await page.waitForTimeout(700)}
   const point=await page.evaluate(target=>{const r=document.querySelector('.world-map').getBoundingClientRect();for(let y=r.top+80;y<r.bottom-40;y+=15)for(let x=r.left+40;x<r.right-80;x+=15){const element=document.elementFromPoint(x,y),country=element?.closest('path.country');if(target==='ocean'?element?.matches('.world-map') : country?.dataset.countryId===target){return{x,y}}}return null},target)
   if(!point)throw Error(`No point ${target}`)
   await page.mouse.move(point.x,point.y);await page.waitForTimeout(100)
   await page.evaluate(()=>{window.__panStart={events:[],rendererStates:[]}})
   await page.mouse.down();await page.mouse.move(point.x+8,point.y);await page.mouse.move(point.x+16,point.y);await page.waitForTimeout(80);await page.mouse.up()
   const record=await page.evaluate(()=>{const r=window.__panStart;window.__panStart=null;const down=r.events.find(e=>e.type==='pointerdown'),move=r.events.find(e=>e.type==='pointermove');return{...r,downHandlerMs:down?.handlerEnd-down?.start,moveHandlerMs:move?.handlerEnd-move?.start,moveToTransformMs:r.transform-move?.start,moveToNextRAFMs:r.nextRAF-move?.start}})
   runs.push({bathymetry,renderer,detail:detail?'10m':'50m',style:original?'released stroke policy':'candidate',target,trial,...record})
  }
  console.error(`${detail?'10m':'50m'} ${original?'original':'candidate'} done`)
  await context.close()
 }
}finally{await browser.close()}
writeFileSync(process.env.PAN_START_OUTPUT || '/private/tmp/geo-go-go-pan-start-results.json',JSON.stringify({bathymetry,renderer,url,runs},null,2))
