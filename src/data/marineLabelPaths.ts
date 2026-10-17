import type { MapPoint } from '../composables/useMapZoom'
import generated from './marine-label-paths.json'
import overrides from './marine-label-overrides.json'

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
  textScale?: number
  // Font pixels at the shared 1600px-wide, projection-scale-1 reference view.
  textSize?: number
  // Extra spacing between letters, relative to the font size.
  letterSpacing?: number
  rotation?: number
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
  'ne:1159116143': { // Laccadive Sea: reverse the bend around its existing center.
    points: [[74.046564, 11.121151], [75.787762, 6.624515], [78.912937, 4.916062]],
    readablePoints: undefined,
  },
  'ne:1159115305': { // Sea of Japan: sweep northeast through the central basin.
    points: [[132.567311, 36.716987], [133.263113, 38.880715], [135.690493, 40.821501], [138.108417, 42.739805], [139.176528, 45.01112]],
    spanFraction: 0.834104, readablePoints: undefined,
  },
  'ne:1159117043': { points: [[-76.35, 39.1], [-76.42, 38.6], [-76.23, 38], [-76.1, 37.3], [-76.05, 36.98]] },
  'ne:1159117301': { points: [[-86.1, 20.6], [-85.75, 21.7], [-85.2, 22.6]] },
  'ne:1159118553': { // Strait of Magellan: center the bend within the passage.
    points: [[-70.60, -53.55], [-70.65, -53.3], [-70.51, -52.95]],
    readablePoints: undefined,
  },
  'ne:1159119181': { // Sea of Marmara
    points: [[27.58, 40.77], [28.22, 40.77], [28.87, 40.77]],
    sizeScale: 0.46, readablePoints: undefined,
  },
  'ne:1159118835': { // Bosporus: use more of the winding strait.
    points: [[29.01, 41.035], [29.047, 41.085], [29.066, 41.13], [29.10, 41.175]],
    spanFraction: 0.92, readablePoints: undefined,
  },
  'ne:1159116947': { // Taiwan Strait
    points: [[118.8, 23.94], [119.45, 24.45], [120.06, 24.98]],
    sizeScale: 0.48, readablePoints: undefined,
  },
  'ne:1159116907': { // Korea Strait: two lines west of Tsushima.
    points: [[127.65, 33.85], [128.25, 33.85], [128.9, 33.85]],
    layout: 'horizontal', anchor: [128.25, 33.85],
    bounds: [[127.4, 33.43], [129.1, 34.27]],
    sizeScale: 0.56, readablePoints: undefined,
  },
  'ne:1159118281': { // Cook Strait: keep the reviewed center, with more room.
    points: [[174.630984, -41.586576], [174.479632, -41.395982], [174.53769, -41.006556]],
    layout: 'horizontal', anchor: [174.515544, -41.488418],
    bounds: [[174.124123, -41.655477], [174.906965, -41.32136]],
    sizeScale: 0.48, readablePoints: undefined,
  },
  'ne:1159116269': { points: [[-72, -59], [-66, -58.5], [-60, -59]] },
  // Restore waters whose source footprints or winding channels could not
  // yield an automatic guide. Keep their water-following corridors intact,
  // and use the normal path-length sizing rather than tiny coast-width caps.
  'ne:1159115729': { // Luzon Strait
    points: [[119.9, 21.35], [121.0, 21.35], [122.2, 21.35]],
    readablePoints: undefined,
  },
  'ne:1159116927': { // Seto Inland Sea
    points: [[131.3, 33.8], [131.65, 33.82], [132.0, 33.85]],
    readablePoints: undefined,
  },
  'ne:1159117067': { // Strait of Gibraltar
    points: [[-5.851139, 35.923033], [-5.700023, 35.925266], [-5.545031, 35.957333], [-5.427882, 36.007702], [-5.262298, 36.043897], [-5.182091, 36.042104]],
    readablePoints: undefined,
  },
  'ne:1159118231': { // La Pérouse Strait
    points: [[141.6, 45.66], [142.1, 45.68], [142.7, 45.7]],
    readablePoints: undefined,
  },
  'ne:1159118905': { // Maputo Bay
    points: [[32.7, -26.15], [32.8, -26.02], [32.87, -25.86]],
    readablePoints: undefined,
  },
  'ne:1159118925': { // St. Helena Bay
    points: [[18.03, -32.63], [18.13, -32.57], [18.23, -32.52]],
    readablePoints: undefined,
  },
  'ne:1159119119': { // Gulf of Ob
    points: [[73.08, 69.3], [73.12, 70.0], [72.98, 70.7], [72.85, 71.4]],
    readablePoints: undefined,
  },
  'ne:1159118853': { // Bab-el-Mandeb
    points: [[43.16, 12.83], [43.3, 12.69], [43.5, 12.51]],
    readablePoints: undefined,
  },
  'ne:1159119155': { // Dardanelles
    points: [[26.47, 40.23], [26.55, 40.28], [26.65, 40.365]],
    readablePoints: undefined,
  },
  'ne:1159119885': { // George VI Sound
    points: [[-68.65, -69.8], [-68.2, -70.6], [-67.9, -71.3], [-68.0, -72.0], [-68.6, -72.6], [-70.0, -73.0], [-72.0, -73.0]],
    readablePoints: undefined,
  },
  'ne:1159117755': { // Kara Strait
    points: [[57.8, 70.4], [58.3, 70.5], [58.8, 70.65]],
    readablePoints: undefined,
  },
  'ne:1159120685': { // San Francisco Bay
    points: [[-122.35, 37.79], [-122.32, 37.735], [-122.29, 37.69], [-122.24, 37.635], [-122.19, 37.59]],
    spanFraction: 0.92, readablePoints: undefined,
  },
  'ne:1159117781': { // Sognefjord
    points: [[5.55, 61.094], [5.68, 61.12], [5.82, 61.135], [5.95, 61.136], [6.07, 61.124]],
    readablePoints: undefined,
  },
  'ne:1159118943': { // Boknafjord: use the long southwest-to-northeast water corridor.
    points: [[5.15, 59.045], [5.4, 59.11], [5.56, 59.17], [5.74, 59.23], [5.90, 59.30]],
    layout: undefined, anchor: undefined, bounds: undefined,
    spanFraction: 0.92, readablePoints: undefined,
  },
  'ne:1159117797': { // Trondheimsfjord
    points: [[10.18, 63.505], [10.36, 63.545], [10.56, 63.56]],
    readablePoints: undefined,
  },
  'ne:1159120015': { // Matochkin Strait
    points: [[54.45, 73.378], [54.6, 73.392], [54.75, 73.42]],
    readablePoints: undefined,
  },
}

const prepared = generated as unknown as Record<string, MarineLabelPath>
const maintained = overrides.placements as unknown as Record<string, MarineLabelPath>
export const marineLabelPaths: Record<string, MarineLabelPath> = Object.fromEntries(
  [...new Set([...Object.keys(prepared), ...Object.keys(authored), ...Object.keys(overrides.placements)])]
    .filter(id => !overrides.removedIds.includes(id))
    // Draft placements are complete snapshots; merging would restore removed
    // offsets, readable guides, or layout fields from the older preparation.
    .map((id) => [id, maintained[id]
      ?? { ...prepared[id], ...authored[id], offset: offsets[id] }]),
)
