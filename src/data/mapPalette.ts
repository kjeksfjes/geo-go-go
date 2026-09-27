// The SVG fallback and canvas worker must paint the same map. Keep their
// shared geographic colors here; interaction feedback colors remain in CSS.
export const mapPalette = {
  ocean: '#61acd3',
  land: '#fcf8e9',
  contextLand: '#c2d2cf',
  contextBorder: '#7396a0',
  border: '#5e7680',
  regionalDivision: '#547987',
  regionalDivisionDash: [7, 6],
  bathymetry: {
    200: '#78bbdc',
    2000: '#63add3',
    6000: '#509dcc',
  } as Record<number, string>,
  relief: {
    500: ['#bfd6a4', 0.3],
    1000: ['#abc991', 0.23],
    1500: ['#9bbc88', 0.2],
    2250: ['#8caa82', 0.17],
    3000: ['#7d9d77', 0.14],
  } as Record<number, [string, number]>,
}

export const mapPaletteCssVariables: Record<string, string> = {
  '--map-ocean': mapPalette.ocean,
  '--map-land': mapPalette.land,
  '--map-context-land': mapPalette.contextLand,
  '--map-context-border': mapPalette.contextBorder,
  '--map-border': mapPalette.border,
  '--map-regional-division': mapPalette.regionalDivision,
  '--map-regional-division-dash': mapPalette.regionalDivisionDash.join(' '),
  ...Object.fromEntries(Object.entries(mapPalette.bathymetry)
    .map(([depth, color]) => [`--map-bathymetry-${depth}`, color])),
  ...Object.fromEntries(Object.entries(mapPalette.relief)
    .flatMap(([elevation, [color, opacity]]) => [
      [`--map-relief-${elevation}`, color],
      [`--map-relief-${elevation}-opacity`, String(opacity)],
    ])),
}
