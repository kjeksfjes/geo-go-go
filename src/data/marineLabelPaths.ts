import type { MapPoint } from '../composables/useMapZoom'
import generated from './marine-label-paths.json'

// Generated water corridors follow source polygon shape; authored overrides
// refine distinctive seas. These guides never change boundaries or names.
export interface MarineLabelPath { points: MapPoint[]; center?: number; readablePoints?: MapPoint[]; offset?: MapPoint }
const offsets: Record<string, MapPoint> = {
  'ne:1159116897': [0, -0.15], // Seram Sea: slightly south.
  'ne:1159120201': [0, -0.025], // Dampier Strait: slightly south.
  'ne:1159116395': [0, -0.12], // White Sea: slightly south.
  'ne:1159115521': [0.08, 0], // Red Sea: just east.
}
const authored: Record<string, MarineLabelPath> = {
  'ocean:arctic': { points: [[-12, 81.8], [10, 82.4], [42, 82]] },
  'ne:1159115321': { points: [[0, 38], [6, 38.6], [10.8, 37.6], [14, 35.6], [21, 34.5]], center: 0.62 },
  'ne:1159115521': { points: [[34.5, 26.8], [36.3, 24], [39, 19.8], [42.6, 14.8]] },
  'ne:1159115503': { points: [[-157, 54], [-148, 55.5], [-138, 56.8]] },
  'ne:1159115461': { points: [[49.4, 44.2], [50.4, 42.6], [51.2, 40.6], [51, 38.6]], center: 0.4 },
  'ne:1159115399': { points: [[-96, 24.5], [-91, 25.8], [-85, 26.2]] },
  'ne:1159115379': { points: [[-83, 16.5], [-78, 14], [-74, 14.5], [-68, 16], [-64, 15.5]], center: 0.6 },
  'ne:1159115171': { points: [[29, 42.5], [33.5, 43.2], [37.5, 43], [40, 42.5]] },
}

const prepared = generated as unknown as Record<string, MarineLabelPath>
export const marineLabelPaths: Record<string, MarineLabelPath> = Object.fromEntries(
  [...new Set([...Object.keys(prepared), ...Object.keys(authored)])]
    .map((id) => [id, { ...prepared[id], ...authored[id], offset: offsets[id] }]),
)
