import source from './marine-labels.json'
import overrides from './marine-label-overrides.json'

export interface MarineLabel {
  id: string
  name: string
  nameNb: string
  stackedText?: string
  stackedTextNb?: string
  kind: string
  point: [number, number]
  rank: number
  minLabel: number
  maxLabel: number
}

// Keep reviewed editor changes separate from regenerated Natural Earth data.
const textOverrides = overrides.labelText as Record<string, MarineLabelText>
export const marineLabels: MarineLabel[] = [...source as MarineLabel[], ...overrides.addedLabels as MarineLabel[]]
  .filter(label => !overrides.removedIds.includes(label.id))
  .map(label => ({ ...label, ...textOverrides[label.id] }))

export type MarineLabelText = Partial<Pick<MarineLabel, 'name' | 'nameNb' | 'stackedText' | 'stackedTextNb'>>
