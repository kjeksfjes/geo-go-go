export const scaleUnitSystems = ['metric', 'imperial', 'nautical'] as const
export type ScaleUnitSystem = typeof scaleUnitSystems[number]

export interface MapScaleBar {
  width: number
  midpoint: string
  total: string
}

const unitDistances = {
  metric: { large: ['km', 1], small: ['m', 1000], switchBelowKm: 1 },
  imperial: { large: ['mi', 0.621371192237334], small: ['ft', 3280.839895], switchBelowKm: 1.609344 },
  nautical: { large: ['nmi', 1 / 1.852], small: ['nmi', 1 / 1.852], switchBelowKm: 0 },
} as const

function fractionDigits(value: number) {
  for (let digits = 0; digits <= 6; digits++) {
    const scaled = value * 10 ** digits
    if (Math.abs(scaled - Math.round(scaled)) < 1e-7) return digits
  }
  return 6
}

export function mapScaleBar(
  kilometresPerPixel: number,
  viewportWidth: number,
  units: ScaleUnitSystem,
  locale: 'en' | 'nb',
): MapScaleBar | null {
  if (!Number.isFinite(kilometresPerPixel) || kilometresPerPixel <= 0) return null

  const preferredWidth = Math.min(220, Math.max(130, viewportWidth * 0.24))
  const maximumWidth = Math.min(260, viewportWidth * 0.5)
  const unit = unitDistances[units]
  const [symbol, unitsPerKilometre] = kilometresPerPixel * preferredWidth < unit.switchBelowKm
    ? unit.small
    : unit.large
  const unitsPerPixel = kilometresPerPixel * unitsPerKilometre
  const magnitude = Math.floor(Math.log10(unitsPerPixel * preferredWidth))
  let best: { distance: number; width: number; score: number } | null = null

  for (let power = magnitude - 1; power <= magnitude + 1; power++) {
    for (const step of [1, 2, 2.5, 5]) {
      const distance = step * 10 ** power
      const width = distance / unitsPerPixel
      if (width < 80 || width > maximumWidth) continue
      const score = Math.abs(Math.log(width / preferredWidth))
      if (!best || score < best.score) best = { distance, width, score }
    }
  }
  if (!best) return null

  const formatter = new Intl.NumberFormat(locale === 'nb' ? 'nb-NO' : 'en-US', {
    maximumFractionDigits: fractionDigits(best.distance / 2),
  })
  return {
    width: best.width,
    midpoint: formatter.format(best.distance / 2),
    total: `${formatter.format(best.distance)} ${symbol}`,
  }
}
