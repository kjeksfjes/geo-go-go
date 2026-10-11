// geoPath emits absolute M/L coordinates and Z closures. Combine translated
// copies into one fill so their shared edges are rasterized together.
export function wrappedMapPath(path: string, offsets: readonly number[]): string {
  return offsets.map((offset) => offset === 0 ? path : path.replace(
    /([ML])(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?),/gi,
    (_, command: string, x: string) => `${command}${Number(x) + offset},`,
  )).join(' ')
}
