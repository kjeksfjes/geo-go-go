// Production-browser diagnostics. Uses a disposable profile, never a signed-in browser.
// Supply an existing Playwright installation and browser; no dependency installation is performed.
// PLAYWRIGHT_PACKAGE=/absolute/path/to/playwright BROWSER_EXECUTABLE=/absolute/path/to/chrome-headless-shell \
//   node scripts/profile-map-browser.mjs http://127.0.0.1:4178/ 3 > /tmp/map-browser-profile.json
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')
const url = process.argv[2] || 'http://127.0.0.1:4178/'
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Use a local production preview')
const repeats = Number(process.argv[3] || 3)
const layers = process.env.PROFILE_LAYERS === '1'
const touch = process.env.PROFILE_TOUCH === '1'
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) })
const profiles = [
  { name: 'desktop', width: 1200, height: 800, dpr: 1, cpu: 1, mobile: false, layers },
  { name: 'mobile-proxy', width: 390, height: 844, dpr: 3, cpu: 4, mobile: true },
]
const focusReference = process.env.PROFILE_BUILD_REF
const focusSource = focusReference ? execFileSync('git', ['show', `${focusReference}:src/logic/mapFocus.ts`], { encoding: 'utf8' }) : readFileSync(new URL('../src/logic/mapFocus.ts', import.meta.url))
const result = { url, focusReference: focusReference ?? 'working tree', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), focusSourceSha256: createHash('sha256').update(focusSource).digest('hex'), browser: browser.version(), diagnostics: { gestures: process.env.PROFILE_GESTURE_AUDIT === '1', gestureTrace: process.env.PROFILE_GESTURE_TRACE === '1', freezeHitTransform: process.env.PROFILE_FREEZE_HIT === '1', stressZoom: process.env.PROFILE_STRESS === '1', lowPinch: process.env.PROFILE_LOW_PINCH === '1', layerGestures: process.env.PROFILE_LAYER_GESTURES === '1', hitScalingStroke: process.env.PROFILE_HIT_SCALING_STROKE === '1', touch }, network: 'Unthrottled loopback; response encodings recorded per run', runs: [] }
async function metric(cdp) {
  return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]))
}
try {
for (const config of profiles) for (const renderer of ['canvas', 'svg']) for (let repeat = 0; repeat < repeats; repeat++) {
  if (process.env.PROFILE_DEVICE && process.env.PROFILE_DEVICE !== config.name) continue
  if (process.env.PROFILE_RENDERER && process.env.PROFILE_RENDERER !== renderer) continue
  const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: config.dpr, isMobile: config.mobile, hasTouch: config.mobile, locale: 'en-US' })
  const page = await context.newPage()
  if (process.env.PROFILE_WORKER === '1') await page.route('**/mapRaster.worker-*.js', async route => {
    const response = await route.fetch()
    const body = await response.text()
    const diagnostic = `;const auditedHandler = self.onmessage; self.onmessage = function(event) { const start = performance.now(); const result = auditedHandler.call(self, event); self.postMessage({type:'auditTiming',stage:event.data.type,purpose:event.data.purpose,version:event.data.version,ms:performance.now()-start}); return result; };`
    await route.fulfill({ response, body: body + diagnostic })
  })
  const errors = []
  const networkBytes = []
  const responseEncodings = new Set()
  page.on('pageerror', error => errors.push(error.message))
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  cdp.on('Network.loadingFinished', event => networkBytes.push(event.encodedDataLength))
  cdp.on('Network.responseReceived', ({ response }) => {
    if (!response.url.endsWith('.js') && !response.url.endsWith('.css')) return
    responseEncodings.add(response.headers['Content-Encoding'] ?? response.headers['content-encoding'] ?? 'identity')
  })
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: config.cpu })
  await cdp.send('Performance.enable')
  await page.addInitScript(initialLayers => {
    localStorage.setItem('geo-go-go.locale', 'en')
    localStorage.setItem('geo-go-go.map.bathymetry', String(initialLayers))
    localStorage.setItem('geo-go-go.map.relief', 'false')
    localStorage.setItem('geo-go-go.map.projection', 'mercator')
    const audit = window.__mapAudit = { longTasks: [], frames: [], workers: [], workerCpu: [], requests: [], readiness: {}, presentations: [] }
    new PerformanceObserver(list => { for (const item of list.getEntries()) audit.longTasks.push({ start: item.startTime, ms: item.duration }) }).observe({ type: 'longtask', buffered: true })
    let last = 0
    function frame(now) {
      if (window.__gestureAudit) audit.presentations.push({at: now, canvas: !!document.querySelector('.world-map--canvas')})
      if (last) audit.frames.push({ start: last, ms: now - last })
      last = now
      if (!audit.readiness.svg && document.querySelector('.world-map .country')) audit.readiness.svg = now
      if (!audit.readiness.canvas && [...document.querySelectorAll('.canvas-map')].some(item => item.style.opacity === '1')) audit.readiness.canvas = now
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args)
        const pending = new Map()
        this.addEventListener('message', event => {
          const data = event.data
          if (data?.type === 'auditTiming') { audit.workerCpu.push(data); return }
          if (data?.type !== 'frame') return
          const key = `${data.version}:${data.purpose}:${data.requestId}`
          const start = pending.get(key)
          if (start !== undefined) audit.workers.push({ purpose: data.purpose, version: data.version, ms: performance.now() - start, pixels: data.bitmap.width * data.bitmap.height })
        })
        const original = this.postMessage.bind(this)
        this.postMessage = (...args) => {
          const data = args[0], start = performance.now()
          if (data?.type === 'render') pending.set(`${data.version}:${data.purpose}:${data.requestId}`, start)
          const value = original(...args)
          audit.requests.push({ start, type: data?.type, purpose: data?.purpose, version: data?.version, ms: performance.now() - start })
          return value
        }
      }
    }
  }, config.layers ?? false)
  if (process.env.PROFILE_GESTURE_AUDIT === '1') await page.addInitScript(() => { window.__gestureAudit = true })
  if (process.env.PROFILE_HIT_SCALING_STROKE === '1') await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.world-map--canvas .country--hit-only:not(:focus-visible) { vector-effect: none !important; }'
      document.head.append(style)
    })
  })
  const ready = async () => {
    await page.waitForFunction(() => document.querySelector('.world-map .country') && !document.querySelector('.map-stage--busy') && !document.querySelector('[role=switch][aria-busy=true]'), { timeout: 120000 })
    if (renderer === 'canvas') await page.waitForFunction(() => document.querySelector('.world-map--canvas'), { timeout: 120000 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  const snapshot = async () => ({ ...await page.evaluate(() => ({ at: performance.now(), longTasks: window.__mapAudit.longTasks, readiness: window.__mapAudit.readiness,
    workers: window.__mapAudit.workers, workerCpu: window.__mapAudit.workerCpu, requests: window.__mapAudit.requests,
    paths: document.querySelectorAll('path.country').length,
    pathCharacters: [...document.querySelectorAll('path.country')].reduce((sum, path) => sum + path.getAttribute('d').length, 0),
    map: { width: document.querySelector('.world-map').clientWidth, height: document.querySelector('.world-map').clientHeight },
    canvases: [...document.querySelectorAll('.canvas-map')].map(canvas => ({ width: canvas.width, height: canvas.height })),
    resources: performance.getEntriesByType('resource').filter(item => /\.(js|css)$/.test(new URL(item.name).pathname)).map(item => ({ file: new URL(item.name).pathname.split('/').pop(), start: item.startTime, end: item.responseEnd, bytes: item.encodedBodySize })),
  })), metrics: await metric(cdp) })
  const phases = {}
  async function phase(name, action) {
    const start = await page.evaluate(() => performance.now())
    const before = await metric(cdp)
    const traceGesture = process.env.PROFILE_GESTURE_TRACE === '1' && /^(high|low|relief)(Pan|Zoom|ZoomOut|Pinch)$/.test(name)
    const traceEvents = []
    const collectTrace = event => traceEvents.push(...event.value)
    if (traceGesture) {
      cdp.on('Tracing.dataCollected', collectTrace)
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', options: 'record-as-much-as-possible' })
    }
    const freezeHit = process.env.PROFILE_FREEZE_HIT === '1' && /^(high|low|relief)(Pan|Zoom|ZoomOut|Pinch)$/.test(name)
    if (freezeHit) await page.evaluate(() => {
      const node = document.querySelector('.map-content')
      const original = node.setAttribute.bind(node)
      window.__restoreHitTransform = () => { node.setAttribute = original; if (window.__lastHitTransform) original('transform', window.__lastHitTransform) }
      node.setAttribute = (key, value) => { if (key === 'transform') window.__lastHitTransform = value; else original(key, value) }
    })
    await action(); await ready()
    const end = await page.evaluate(() => performance.now())
    const after = await metric(cdp)
    const timing = await page.evaluate(({ start, end }) => {
      const tasks = window.__mapAudit.longTasks.filter(item => item.start >= start && item.start < end)
      const frames = window.__mapAudit.frames.filter(item => item.start >= start && item.start < end).map(item => item.ms).sort((a, b) => a - b)
      const presentations = window.__mapAudit.presentations.filter(item => item.at >= start && item.at < end)
      const requests = window.__mapAudit.requests.filter(item => item.start >= start && item.start < end)
      return { presentations: presentations.length, svgFallbackFrames: presentations.filter(item => !item.canvas).length,
        scenePosts: requests.filter(item => item.type === 'scene').length,
        detailRequests: requests.filter(item => item.type === 'render' && item.purpose === 'detail').length,
        longTaskCount: tasks.length, longTaskMs: tasks.reduce((sum, item) => sum + item.ms, 0), maxLongTaskMs: Math.max(0, ...tasks.map(item => item.ms)), frameP95Ms: frames[Math.floor(frames.length * 0.95)] ?? null, maxFrameMs: frames.at(-1) ?? null }
    }, { start, end })
    if (traceGesture) {
      const finished = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve))
      await cdp.send('Tracing.end'); await finished
      cdp.off('Tracing.dataCollected', collectTrace)
      const stacks = new Map(), complete = []
      for (const event of traceEvents) {
        const key = `${event.pid}:${event.tid}`, stack = stacks.get(key) ?? []
        stacks.set(key, stack)
        if (event.ph === 'B') stack.push(event)
        if (event.ph === 'E' && stack.length) { const first = stack.pop(); complete.push({ ...first, dur: event.ts - first.ts }) }
        if (event.ph === 'X') complete.push(event)
      }
      timing.trace = {}
      timing.layoutStacks = {}
      const mainThreads = new Set(traceEvents.filter(event => event.name === 'thread_name' && event.args?.name === 'CrRendererMain').map(event => `${event.pid}:${event.tid}`))
      timing.traceScope = mainThreads.size ? 'CrRendererMain' : 'All recorded threads; categories may overlap'
      for (const event of complete) {
        if (mainThreads.size && !mainThreads.has(`${event.pid}:${event.tid}`)) continue
        if (!event.dur || !/^(RunMicrotasks|FunctionCall|UpdateLayoutTree|Layout|Paint|PrePaint|HitTest|EventDispatch)$/.test(event.name)) continue
        if (event.name === 'Layout') {
          const stack = event.args?.beginData?.stackTrace ?? event.args?.stackTrace
          const key = stack?.slice(0, 5).map(frame => frame.functionName || '(anonymous)').join(' → ') || '(no JavaScript stack)'
          timing.layoutStacks[key] = (timing.layoutStacks[key] ?? 0) + event.dur / 1000
        }
        const item = timing.trace[event.name] ?? { totalMs: 0, maxMs: 0, count: 0 }
        item.totalMs += event.dur / 1000; item.maxMs = Math.max(item.maxMs, event.dur / 1000); item.count++
        timing.trace[event.name] = item
      }
    }
    if (freezeHit) await page.evaluate(() => window.__restoreHitTransform())
    phases[name] = { start, end, elapsedMs: end - start, scriptMs: 1000 * (after.ScriptDuration - before.ScriptDuration), taskMs: 1000 * (after.TaskDuration - before.TaskDuration), layoutMs: 1000 * (after.LayoutDuration - before.LayoutDuration), styleMs: 1000 * (after.RecalcStyleDuration - before.RecalcStyleDuration), ...timing }
  }
  await page.goto(url + (renderer === 'svg' ? '?renderer=svg' : ''), { waitUntil: 'commit' })
  await ready()
  phases.startup = await snapshot()
  if (config.layers) { await page.waitForTimeout(2000); await ready(); phases.optionalDefaultSettled = await snapshot() }
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  const trace = layers || process.env.PROFILE_TRACE === '1'
  if (trace) await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,v8,v8.execute,disabled-by-default-v8.compile', options: 'record-as-much-as-possible' })
  await phase('highDetailCold', () => page.getByRole('switch', { name: 'High detail', exact: true }).click())
  if (trace) {
    const events = []
    cdp.on('Tracing.dataCollected', event => events.push(...event.value))
    const finished = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve))
    await cdp.send('Tracing.end'); await finished
    // Nested events overlap; these totals are categories, not additive phase durations.
    const timings = {}
    const stacks = new Map(), complete = []
    for (const event of events) {
      const key = `${event.pid}:${event.tid}`, stack = stacks.get(key) ?? []
      stacks.set(key, stack)
      if (event.ph === 'B') stack.push(event)
      if (event.ph === 'E' && stack.length) {
        const start = stack.pop()
        complete.push({ ...start, ph: 'X', dur: event.ts - start.ts })
      }
      if (event.ph === 'X') complete.push(event)
    }
    for (const event of complete) {
      if (!event.dur) continue
      if (!/Compile|EvaluateScript|RunMicrotasks|UpdateLayoutTree|Layout$|Paint$/.test(event.name)) continue
      const value = timings[event.name] ?? { totalMs: 0, count: 0, maxMs: 0 }
      value.totalMs += event.dur / 1000; value.count++; value.maxMs = Math.max(value.maxMs, event.dur / 1000)
      timings[event.name] = value
    }
    phases.highTrace = timings
  }
  phases.highReady = await snapshot()
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  async function hitTest() {
    return page.evaluate(() => {
      const bounds = document.querySelector('.world-map').getBoundingClientRect()
      const points = Array.from({ length: 400 }, (_, i) => [bounds.left + ((i * 37) % bounds.width), bounds.top + ((i * 53) % bounds.height)])
      const start = performance.now(); let landHits = 0
      for (const [x, y] of points) if (document.elementFromPoint(x, y)?.matches('path.country')) landHits++
      return { queries: points.length, elapsedMs: performance.now() - start, landHits }
    })
  }
  phases.highHitTest = await hitTest()
  if (layers) await phase('highHover', async () => {
    const rect = await page.locator('.world-map').boundingBox()
    for (let i = 0; i < 60; i++) await page.mouse.move(rect.x + rect.width * (0.15 + 0.7 * (i / 59)), rect.y + rect.height * 0.45)
  })
  async function gesture(kind) {
    if (kind === 'pan' && config.mobile && touch) {
      const rect = await page.locator('.world-map').boundingBox()
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
      for (let i = 0; i < 45; i++) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 2, y, id: 1 }] })
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(300)
      return
    }
    if (kind === 'pan') {
      const rect = await page.locator('.world-map').boundingBox()
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
      await page.mouse.move(x, y); await page.mouse.down()
      for (let i = 0; i < 45; i++) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
        await page.mouse.move(x + i * 2, y)
      }
      await page.mouse.up(); await page.waitForTimeout(300)
      return
    }
    await page.evaluate(async ({ kind, steps, delta }) => {
      const svg = document.querySelector('.world-map'), rect = svg.getBoundingClientRect()
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
      const dispatch = (type, dx = 0) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 42, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x + dx, clientY: y }))
      if (kind === 'pan') dispatch('pointerdown')
      for (let i = 0; i < steps; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve))
        if (kind === 'pan') dispatch('pointermove', i * 2)
        else svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: kind === 'zoomOut' ? delta : -delta }))
      }
      if (kind === 'pan') dispatch('pointerup', 88)
      await new Promise(resolve => setTimeout(resolve, 300))
    }, { kind, steps: process.env.PROFILE_STRESS === '1' ? 120 : 45, delta: process.env.PROFILE_STRESS === '1' ? 16 : 8 })
  }
  await phase('highZoom', () => gesture('zoom'))
  await phase('highPan', () => gesture('pan'))
  if (process.env.PROFILE_STRESS === '1') await phase('highZoomOut', () => gesture('zoomOut'))
  async function pinchGesture() {
    const rect = await page.locator('.world-map').boundingBox()
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
    const points = gap => [{ x: x - gap, y, id: 1 }, { x: x + gap, y, id: 2 }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(35) })
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(35 + i) })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(300)
  }
  if (config.mobile && touch) await phase('highPinch', pinchGesture)
  await phase('highCountryActivation', () => page.locator('path.country[data-country-id="KEN"]').first().press('Enter'))
  await phase('quizCold', () => page.getByRole('button', { name: 'Find the country', exact: true }).click())
  await phase('exploreReturn', () => page.getByRole('button', { name: 'Explore', exact: true }).click())
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await phase('lowDetailReturn', () => page.getByRole('switch', { name: 'High detail', exact: true }).click())
  phases.lowHitTest = await hitTest()
  if (layers) await phase('lowHover', async () => {
    const rect = await page.locator('.world-map').boundingBox()
    for (let i = 0; i < 60; i++) await page.mouse.move(rect.x + rect.width * (0.15 + 0.7 * (i / 59)), rect.y + rect.height * 0.45)
  })
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await phase('lowZoom', () => gesture('zoom'))
  await phase('lowPan', () => gesture('pan'))
  if (config.mobile && touch && process.env.PROFILE_LOW_PINCH === '1') await phase('lowPinch', pinchGesture)
  if (process.env.PROFILE_STRESS === '1') await phase('lowZoomOut', () => gesture('zoomOut'))
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await phase('highDetailWarm', () => page.getByRole('switch', { name: 'High detail', exact: true }).click())
  for (let cycle = 0; cycle < Number(process.env.PROFILE_WARM_REPEAT || 0); cycle++) {
    await cdp.send('HeapProfiler.collectGarbage')
    await page.waitForTimeout(200)
    await phase(`lowDetailWarmCycle:${cycle}`, () => page.getByRole('switch', { name: 'High detail', exact: true }).click())
    await page.waitForTimeout(200)
    await phase(`highDetailWarmCycle:${cycle}`, () => page.getByRole('switch', { name: 'High detail', exact: true }).click())
  }
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  // TreeSelect's visible region rows are identified by their displayed label.
  await page.locator('.header-region-control').click()
  await phase('europeCold', () => page.locator('.vue3-treeselect__label').filter({ hasText: /^Europe$/ }).click())
  phases.final = await snapshot()
  await cdp.send('HeapProfiler.collectGarbage')
  phases.heapAfterGC = await metric(cdp)
  if (layers) {
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    await phase('reliefActivation', () => page.getByRole('switch', { name: 'Relief', exact: true }).click())
    await page.waitForTimeout(2000); await ready(); phases.layersSettled = await snapshot()
    if (process.env.PROFILE_LAYER_GESTURES === '1') {
      await page.getByRole('button', { name: 'Map settings', exact: true }).click()
      await phase('reliefZoom', () => gesture('zoom'))
      await phase('reliefPan', () => gesture('pan'))
    }
  }
  result.runs.push({ config, renderer, repeat, phases, errors, responseEncodings: [...responseEncodings], totalNetworkBytes: networkBytes.reduce((sum, value) => sum + value, 0) })
  console.error(`${config.name}/${renderer}/${repeat}: startup=${phases.startup.at.toFixed(0)}ms high=${phases.highDetailCold.elapsedMs.toFixed(0)}ms heap=${(phases.final.metrics.JSHeapUsedSize / 1e6).toFixed(1)}MB`)
  await context.close()
}
} finally { await browser.close() }
console.log(JSON.stringify(result, null, 2))
