// The SVG fallback and canvas worker must paint the same map. Keep their
// shared geographic colors here; interaction feedback colors remain in CSS.
export const mapPalette = {
  ocean: '#61acd3',
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
    6000: '#509dcc',
  } as Record<number, string>,
  // These elevation polygons are nested. Screen-blend each warm tint over the
  // darker relief land so every additional band increases lightness.
  relief: {
    500: ['#f1dfad', 0.38],
    1000: ['#f3d7a0', 0.32],
    1500: ['#f4d095', 0.28],
    2250: ['#f5d6a4', 0.25],
    3000: ['#f8e5c4', 0.22],
    4000: ['#fbf1dc', 0.2],
  } as Record<number, [string, number]>,
}

export const mapPaletteCssVariables: Record<string, string> = {
  '--map-ocean': mapPalette.ocean,
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
