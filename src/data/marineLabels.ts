import source from './marine-labels.json'

export interface MarineLabel {
  id: string
  name: string
  nameNb: string
  kind: string
  point: [number, number]
  rank: number
  minLabel: number
  maxLabel: number
}

export const marineLabels = source as MarineLabel[]
