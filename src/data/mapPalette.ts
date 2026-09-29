// The SVG fallback and canvas worker must paint the same map. Keep their
// shared geographic colors here; interaction feedback colors remain in CSS.
export const mapPalette = {
  ocean: '#61acd3',
  bathymetrySurface: '#8ac8e3',
  land: '#fcf8e9',
  reliefLand: '#e3ded2',
  contextLand: '#c2d2cf',
  contextBorder: '#7396a0',
  border: '#5e7680',
  regionalDivision: '#547987',
  regionalDivisionDash: [7, 6],
  bathymetry: {
    200: '#78bbdc',
    2000: '#63add3',
    3000: '#5fa9d1',
    4000: '#5ba5cf',
    5000: '#55a0cd',
    6000: '#509dcc',
    7000: '#3f89bc',
  } as Record<number, string>,
  // These elevation polygons are nested. Screen-blend each warm tint over the
  // darker relief land so every additional band increases lightness.
  relief: {
    500: ['#f4e7c5', 0.42],
    1000: ['#f6e4bc', 0.38],
    1500: ['#f8e2b8', 0.36],
    2250: ['#fae8c9', 0.34],
    3000: ['#fdf3df', 0.34],
    4000: ['#fffdf8', 0.42],
  } as Record<number, [string, number]>,
}

export const mapPaletteCssVariables: Record<string, string> = {
  '--map-ocean': mapPalette.ocean,
  '--map-bathymetry-surface': mapPalette.bathymetrySurface,
  '--map-land': mapPalette.land,
  '--map-relief-land': mapPalette.reliefLand,
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
