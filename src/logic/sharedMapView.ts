import type { MapProjectionId } from '../composables/useMapProjection'

export interface SharedMapView {
  lat: number
  lon: number
  zoom: number
  region: string
  projection: MapProjectionId
  animate?: boolean
}

const projections = ['mercator', 'miller', 'winkel-tripel', 'natural-earth', 'regional-equal-area']

export function validateSharedMapView(input: unknown): SharedMapView | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  const { lat, lon, zoom, region = 'world', projection = 'mercator', animate } = value
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90
    || typeof lon !== 'number' || !Number.isFinite(lon) || Math.abs(lon) > 180
    || typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom < 1 || zoom > 16384
    || typeof region !== 'string' || !/^[a-z][a-z-]{0,60}$/.test(region)
    || typeof projection !== 'string' || !projections.includes(projection)
    || (animate !== undefined && typeof animate !== 'boolean')) return null
  return { lat, lon, zoom, region, projection: projection as MapProjectionId,
    ...(animate !== undefined ? { animate } : {}), }
}

export function parseSharedMapView(hash: string): SharedMapView | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const coordinates = params.get('view')?.split(',')
  if (!coordinates || coordinates.length !== 3 || coordinates.some(value => !value.trim())) return null
  return validateSharedMapView({
    lat: Number(coordinates[0]), lon: Number(coordinates[1]), zoom: Number(coordinates[2]),
    region: params.get('region') ?? 'world', projection: params.get('projection') ?? 'mercator',
  })
}

export function sharedMapViewHash(view: SharedMapView): string {
  const rounded = (value: number) => String(Number(value.toFixed(6)))
  const params = new URLSearchParams({
    view: [view.lat, view.lon, view.zoom].map(rounded).join(','),
    region: view.region, projection: view.projection,
  })
  return `#${params.toString().replaceAll('%2C', ',')}`
}
