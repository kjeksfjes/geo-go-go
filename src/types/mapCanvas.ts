export interface CanvasCamera {
  x: number
  y: number
  scale: number
}

export interface CanvasMapScene {
  spherePath: string
  bathymetry: Array<{ depth: number; path: string }>
  contextCountries: Array<{ path: string; bounds: [[number, number], [number, number]] }>
  relief: Array<{ elevation: number; path: string }>
  reliefClipPath: string
  countries: Array<{
    path: string
    outlinePath?: string
    divisionPath?: string
    internalBoundary?: boolean
    bounds: [[number, number], [number, number]]
  }>
}

export type CanvasWorkerRequest =
  | { type: 'scene'; version: number; scene: CanvasMapScene }
  | {
      type: 'render'
      purpose: 'overview' | 'detail' | 'settled'
      version: number
      requestId: number
      width: number
      height: number
      pixelRatio: number
      overscan: number
      camera: CanvasCamera
      wrapOffset: number | null
    }

export interface CanvasWorkerFrame {
  type: 'frame'
  purpose: 'overview' | 'detail' | 'settled'
  version: number
  requestId: number
  camera: CanvasCamera
  width: number
  height: number
  overscan: number
  bitmap: ImageBitmap
}
