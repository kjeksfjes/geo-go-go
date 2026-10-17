import source from './marine-labels.json'

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

export const marineLabels = source as MarineLabel[]

export type MarineLabelText = Partial<Pick<MarineLabel, 'name' | 'nameNb' | 'stackedText' | 'stackedTextNb'>>
