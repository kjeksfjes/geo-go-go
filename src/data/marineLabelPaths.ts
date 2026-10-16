import type { MapPoint } from '../composables/useMapZoom'
import generated from './marine-label-paths.json'

// Generated water corridors follow source polygon shape; authored overrides
// refine distinctive seas. These guides never change boundaries or names.
export interface MarineLabelPath {
  points: MapPoint[]
  center?: number
  readablePoints?: MapPoint[]
  offset?: MapPoint
  layout?: 'horizontal'
  anchor?: MapPoint
  bounds?: [MapPoint, MapPoint]
  fontSize?: number
  spanFraction?: number
  sizeScale?: number
}
const offsets: Record<string, MapPoint> = {
  'ne:1159116897': [0, -0.15], // Seram Sea: slightly south.
  'ne:1159120201': [0, -0.025], // Dampier Strait: slightly south.
  'ne:1159116395': [0, -0.12], // White Sea: slightly south.
}
const authored: Record<string, MarineLabelPath> = {
  'ocean:arctic': { points: [[-12, 81.8], [10, 82.4], [42, 82]] },
  'ne:1159120667': {
    points: [[-66.309971, 29.270907], [-59.523372, 27.875263], [-53.291683, 26.593733]],
    layout: 'horizontal', anchor: [-61.874564, 30.719271],
    bounds: [[-69.803618, 24.784435], [-53.94551, 36.654108]], readablePoints: undefined,
  },
  'ne:1159115321': {
    points: [[5, 38.5], [10.8, 37.6], [14.3, 35.9], [21, 34.5], [28, 33.9]],
    center: 0.6, fontSize: 18, readablePoints: undefined,
  },
  'ne:1159115521': {
    points: [[35, 26.4], [36.5, 24], [38.8, 20.5], [41.8, 16.5]],
    fontSize: 14, readablePoints: undefined,
  },
  'ne:1159115695': {
    points: [[-14, 75.5], [-7, 75.5], [3, 75.5]], layout: 'horizontal', anchor: [-7, 75.5],
    bounds: [[-15, 72.5], [4, 78]], readablePoints: undefined,
  },
  'ne:1159115675': {
    points: [[-6, 68.7], [2, 68.7], [7, 68.7]], layout: 'horizontal', anchor: [2, 68.7],
    bounds: [[-7, 65.5], [8, 71]], readablePoints: undefined,
  },
  'ne:1159115861': {
    points: [[29, 74.2], [39, 74.2], [47, 74.2]], layout: 'horizontal', anchor: [39, 74.2],
    bounds: [[28, 71.5], [48, 77]], readablePoints: undefined,
  },
  'ne:1159115503': { points: [[-157, 54], [-148, 55.5], [-138, 56.8]] },
  'ne:1159115597': {
    points: [[49.568258, 28.69842], [52.114051, 26.614516], [54.431481, 25.35805]],
    spanFraction: 0.85, readablePoints: undefined,
  },
  'ne:1159115461': { points: [[49.4, 44.2], [50.4, 42.6], [51.2, 40.6], [51, 38.6]], center: 0.4 },
  'ne:1159115399': { points: [[-96, 24.5], [-91, 25.8], [-85, 26.2]] },
  'ne:1159115379': { points: [[-83, 16.5], [-78, 14], [-74, 14.5], [-68, 16], [-64, 15.5]], center: 0.6 },
  'ne:1159115171': { points: [[29, 42.5], [33.5, 43.2], [37.5, 43], [40, 42.5]] },
  'ne:1159117043': { points: [[-76.35, 39.1], [-76.42, 38.6], [-76.23, 38], [-76.1, 37.3], [-76.05, 36.98]] },
  'ne:1159117301': { points: [[-86.1, 20.6], [-85.75, 21.7], [-85.2, 22.6]] },
  'ne:1159118553': { points: [[-70.7, -53.55], [-70.55, -53.3], [-70.6, -52.95]] },
  'ne:1159116269': { points: [[-72, -59], [-66, -58.5], [-60, -59]] },
}

const prepared = generated as unknown as Record<string, MarineLabelPath>
export const marineLabelPaths: Record<string, MarineLabelPath> = Object.fromEntries(
  [...new Set([...Object.keys(prepared), ...Object.keys(authored)])]
    .map((id) => [id, { ...prepared[id], ...authored[id], offset: offsets[id] }]),
)
