import type { CanvasWorkerFrame, CanvasWorkerRequest, CanvasMapScene } from '../types/mapCanvas'

type DrawPath = Path2D | null
type Bounds = [[number, number], [number, number]]

interface PreparedScene {
  sphere: DrawPath
  bathymetry: Array<{ depth: number; path: DrawPath }>
  relief: Array<{ elevation: number; path: DrawPath }>
  reliefClip: DrawPath
  countries: Array<{ path: DrawPath; outline: DrawPath; division: DrawPath; bounds: Bounds }>
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<CanvasWorkerRequest>) => void) | null
  postMessage: (message: CanvasWorkerFrame, transfer: Transferable[]) => void
}

const bathymetryColors: Record<number, string> = {
  200: '#78bbdc',
  2000: '#63add3',
  6000: '#509dcc',
}
const reliefColors: Record<number, [string, number]> = {
  500: ['#bfd6a4', 0.3],
  1000: ['#abc991', 0.23],
  1500: ['#9bbc88', 0.2],
  2250: ['#8caa82', 0.17],
  3000: ['#7d9d77', 0.14],
}

let sceneVersion = 0
let scene: PreparedScene | null = null
let surface: OffscreenCanvas | null = null

function pathFrom(source?: string): DrawPath {
  return source ? new Path2D(source) : null
}

function prepare(source: CanvasMapScene): PreparedScene {
  return {
    sphere: pathFrom(source.spherePath),
    bathymetry: source.bathymetry.map(({ depth, path }) => ({ depth, path: pathFrom(path) })),
    relief: source.relief.map(({ elevation, path }) => ({ elevation, path: pathFrom(path) })),
    reliefClip: pathFrom(source.reliefClipPath),
    countries: source.countries.map(({ path, outlinePath, divisionPath, bounds }) => ({
      path: pathFrom(path),
      outline: pathFrom(outlinePath),
      division: pathFrom(divisionPath),
      bounds,
    })),
  }
}

function intersectsViewport(bounds: Bounds, offset: number, viewport: Bounds) {
  return bounds[0][0] + offset <= viewport[1][0]
    && bounds[1][0] + offset >= viewport[0][0]
    && bounds[0][1] <= viewport[1][1]
    && bounds[1][1] >= viewport[0][1]
}

function drawScene(
  context: OffscreenCanvasRenderingContext2D,
  prepared: PreparedScene,
  cameraScale: number,
  offsets: number[],
  viewport: Bounds,
) {
  // A close-up usually intersects only a few countries. Reuse that short list
  // for the land fill and border passes instead of replaying every 10m path.
  const visibleCountries = offsets.map((offset) => ({
    offset,
    countries: prepared.countries.filter(({ bounds }) => intersectsViewport(bounds, offset, viewport)),
  }))
  for (const offset of offsets) {
    context.save()
    context.translate(offset, 0)
    if (prepared.sphere) {
      context.fillStyle = '#61acd3'
      context.fill(prepared.sphere)
    }
    context.restore()
  }

  for (const offset of offsets) {
    context.save()
    context.translate(offset, 0)
    for (const band of prepared.bathymetry) {
      if (!band.path) continue
      context.fillStyle = bathymetryColors[band.depth] ?? '#509dcc'
      context.fill(band.path)
    }
    context.restore()
  }

  for (const { offset, countries } of visibleCountries) {
    context.save()
    context.translate(offset, 0)
    context.fillStyle = '#fcf8e9'
    for (const country of countries) {
      if (country.path) context.fill(country.path)
    }
    if (countries.length && prepared.reliefClip && prepared.relief.length) {
      context.save()
      context.clip(prepared.reliefClip)
      for (const band of prepared.relief) {
        if (!band.path) continue
        const [color, opacity] = reliefColors[band.elevation] ?? ['#7d9d77', 0.14]
        context.fillStyle = color
        context.globalAlpha = opacity
        context.fill(band.path)
      }
      context.restore()
    }
    context.restore()
  }

  context.lineJoin = 'round'
  context.lineWidth = 0.85 / cameraScale
  context.strokeStyle = '#5e7680'
  for (const { offset, countries } of visibleCountries) {
    context.save()
    context.translate(offset, 0)
    for (const country of countries) {
      const border = country.outline ?? country.path
      if (border) context.stroke(border)
      if (country.division) {
        context.save()
        context.strokeStyle = '#547987'
        context.lineWidth = 1 / cameraScale
        context.setLineDash([3 / cameraScale, 3 / cameraScale])
        context.stroke(country.division)
        context.restore()
      }
    }
    context.restore()
  }
}

workerScope.onmessage = (event) => {
  const message = event.data
  if (message.type === 'scene') {
    sceneVersion = message.version
    scene = prepare(message.scene)
    return
  }
  if (!scene || message.version !== sceneVersion) return

  const { width, height, pixelRatio, overscan, camera } = message
  const pixelWidth = Math.max(1, Math.round(width * overscan * pixelRatio))
  const pixelHeight = Math.max(1, Math.round(height * overscan * pixelRatio))
  if (!surface || surface.width !== pixelWidth || surface.height !== pixelHeight) {
    surface = new OffscreenCanvas(pixelWidth, pixelHeight)
  }
  const context = surface.getContext('2d')
  if (!context) return
  context.resetTransform()
  context.clearRect(0, 0, pixelWidth, pixelHeight)
  const padX = width * (overscan - 1) / 2
  const padY = height * (overscan - 1) / 2
  context.setTransform(pixelRatio, 0, 0, pixelRatio, pixelRatio * (padX + camera.x), pixelRatio * (padY + camera.y))
  context.scale(camera.scale, camera.scale)
  // Cover the complete overscanned bitmap, including unusually wide viewports.
  // Keeping neighbors in one snapshot also avoids exposed edges during a pan.
  const period = message.wrapOffset
  const copyCount = period === null
    ? 0
    : Math.max(1, Math.ceil(width * overscan / (2 * camera.scale * period)))
  const offsets = period === null
    ? [0]
    : Array.from({ length: 2 * copyCount + 1 }, (_, index) => (index - copyCount) * period)
  const viewport: Bounds = [
    [(-padX - camera.x) / camera.scale, (-padY - camera.y) / camera.scale],
    [(width + padX - camera.x) / camera.scale, (height + padY - camera.y) / camera.scale],
  ]
  // Only Mercator wraps. Each projected world fits within the map width, so
  // skip copies that cannot reach this bitmap at the current camera position.
  const visibleOffsets = period === null
    ? offsets
    : offsets.filter((offset) => offset <= viewport[1][0] && offset + width >= viewport[0][0])
  drawScene(context, scene, camera.scale, visibleOffsets, viewport)

  const frame: CanvasWorkerFrame = {
    type: 'frame',
    purpose: message.purpose,
    version: message.version,
    requestId: message.requestId,
    camera,
    width,
    height,
    overscan,
    bitmap: surface.transferToImageBitmap(),
  }
  workerScope.postMessage(frame, [frame.bitmap])
}
