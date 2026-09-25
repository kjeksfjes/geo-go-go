import type { CanvasWorkerFrame, CanvasWorkerRequest, CanvasMapScene } from '../types/mapCanvas'

type DrawPath = Path2D | null

interface PreparedScene {
  sphere: DrawPath
  land: DrawPath
  bathymetry: Array<{ depth: number; path: DrawPath }>
  relief: Array<{ elevation: number; path: DrawPath }>
  reliefClip: DrawPath
  countries: Array<{ path: DrawPath; outline: DrawPath; division: DrawPath }>
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<CanvasWorkerRequest>) => void) | null
  postMessage: (message: CanvasWorkerFrame, transfer: Transferable[]) => void
}

const bathymetryColors: Record<number, string> = {
  200: '#a6c9d9',
  2000: '#95bdcf',
  6000: '#89b2c7',
}
const reliefColors: Record<number, [string, number]> = {
  500: ['#d9e3d6', 0.3],
  1000: ['#cfdbcc', 0.22],
  1500: ['#c5d2c3', 0.19],
  2250: ['#bac9b8', 0.17],
  3000: ['#afc0af', 0.15],
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
    land: pathFrom(source.landPath),
    bathymetry: source.bathymetry.map(({ depth, path }) => ({ depth, path: pathFrom(path) })),
    relief: source.relief.map(({ elevation, path }) => ({ elevation, path: pathFrom(path) })),
    reliefClip: pathFrom(source.reliefClipPath),
    countries: source.countries.map(({ path, outlinePath, divisionPath }) => ({
      path: pathFrom(path),
      outline: pathFrom(outlinePath),
      division: pathFrom(divisionPath),
    })),
  }
}

function drawScene(context: OffscreenCanvasRenderingContext2D, prepared: PreparedScene, cameraScale: number, offsets: number[]) {
  for (const offset of offsets) {
    context.save()
    context.translate(offset, 0)
    if (prepared.sphere) {
      context.fillStyle = '#b7d4e1'
      context.fill(prepared.sphere)
    }
    context.restore()
  }

  for (const offset of offsets) {
    context.save()
    context.translate(offset, 0)
    for (const band of prepared.bathymetry) {
      if (!band.path) continue
      context.fillStyle = bathymetryColors[band.depth] ?? '#89b2c7'
      context.fill(band.path)
    }
    context.restore()
  }

  for (const offset of offsets) {
    context.save()
    context.translate(offset, 0)
    if (prepared.land) {
      context.fillStyle = '#f9f7ef'
      context.fill(prepared.land)
    }
    if (prepared.reliefClip && prepared.relief.length) {
      context.save()
      context.clip(prepared.reliefClip)
      for (const band of prepared.relief) {
        if (!band.path) continue
        const [color, opacity] = reliefColors[band.elevation] ?? ['#afc0af', 0.15]
        context.fillStyle = color
        context.globalAlpha = opacity
        context.fill(band.path)
      }
      context.restore()
    }
    context.restore()
  }

  context.lineJoin = 'round'
  context.lineWidth = 0.65 / cameraScale
  context.strokeStyle = '#9aa9a9'
  for (const offset of offsets) {
    context.save()
    context.translate(offset, 0)
    for (const country of prepared.countries) {
      const border = country.outline ?? country.path
      if (border) context.stroke(border)
      if (country.division) {
        context.save()
        context.strokeStyle = '#6f8991'
        context.lineWidth = 0.9 / cameraScale
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
  // Keep both adjoining copies in the snapshot. The visible copy can switch
  // sides during a wheel gesture before the worker has painted another frame.
  drawScene(context, scene, camera.scale, message.wrapOffset === null
    ? [0]
    : [-message.wrapOffset, 0, message.wrapOffset])

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
