import type { MarineLabelPath, MarineLabelPlacement } from '../data/marineLabelPaths'

const typography = ['textSize', 'letterSpacing', 'textScale', 'fontSize', 'sizeScale'] as const

export function waterLabelGeometry(placement: MarineLabelPath): MarineLabelPlacement {
  const { additionalPlacements: _additional, ...geometry } = placement
  for (const key of typography) delete geometry[key]
  return geometry
}

export function waterLabelPlacements(root: MarineLabelPath): MarineLabelPath[] {
  const shared = Object.fromEntries(typography.filter(key => root[key] !== undefined).map(key => [key, root[key]]))
  return [root, ...(root.additionalPlacements ?? [])].map(placement => ({ ...waterLabelGeometry(placement), ...shared }))
}

export function replaceWaterLabelPlacements(root: MarineLabelPath, placements: MarineLabelPath[]): MarineLabelPath {
  const value: MarineLabelPath = {
    ...waterLabelGeometry(placements[0]!),
    ...Object.fromEntries(typography.filter(key => root[key] !== undefined).map(key => [key, root[key]])),
  }
  if (placements.length > 1) value.additionalPlacements = placements.slice(1).map(waterLabelGeometry)
  return value
}

export function updateWaterLabelPlacement(root: MarineLabelPath, index: number, placement: MarineLabelPath): MarineLabelPath {
  const shared = { ...root }
  for (const key of typography) {
    if (placement[key] === undefined) delete shared[key]
    else shared[key] = placement[key]
  }
  const placements = waterLabelPlacements(shared)
  placements[index] = placement
  return replaceWaterLabelPlacements(shared, placements)
}

export function waterLabelPlacementId(id: string, index: number): string { return `${id}:placement:${index}` }
