// Inset composition adapted from d3-geo's Albers USA projection.
// Copyright 2010-2024 Mike Bostock
// Permission to use, copy, modify, and/or distribute this software for any purpose
// with or without fee is hereby granted, provided that the above copyright notice
// and this permission notice appear in all copies.
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
// INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
// OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
// TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
// THIS SOFTWARE.
import { geoAlbers, geoConicEqualArea, geoPath, type GeoProjection, type GeoStream } from 'd3-geo'

type Point = [number, number]
type Bounds = [Point, Point]
const layout = {
  // Keep the mainland projection; stack both insets in the Pacific to its west.
  AK: { center: [-0.487, 0.001], bounds: [[-0.605, -0.080], [-0.394, 0.034]] },
  HI: { center: [-0.485, 0.212], bounds: [[-0.494, 0.166], [-0.395, 0.234]] },
} as const

export function usStateInsets(scale: number, translate: Point) {
  return (['AK', 'HI'] as const).map(code => ({ code,
    bounds: layout[code].bounds.map(point => [translate[0] + point[0] * scale, translate[1] + point[1] * scale]) as Bounds,
  }))
}

export function usStateProjectionParts(scale: number, translate: Point) {
  const [x, y] = translate
  const insets = usStateInsets(scale, translate)
  return {
    mainland: geoAlbers().scale(scale).translate(translate)
      .clipExtent([[x - 0.455 * scale, y - 0.238 * scale], [x + 0.455 * scale, y + 0.238 * scale]]),
    alaska: geoConicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]).scale(scale * 0.35)
      .translate([x + layout.AK.center[0] * scale, y + layout.AK.center[1] * scale]).clipExtent(insets[0]!.bounds),
    hawaii: geoConicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]).scale(scale)
      .translate([x + layout.HI.center[0] * scale, y + layout.HI.center[1] * scale]).clipExtent(insets[1]!.bounds),
  }
}

function contains(bounds: Bounds, point: Point) {
  return point[0] >= bounds[0][0] && point[0] <= bounds[1][0] && point[1] >= bounds[0][1] && point[1] <= bounds[1][1]
}

// Like d3.geoAlbersUsa, the composite exposes scale, translate, precision,
// fitExtent/fitSize, streaming and inversion, with fixed constituent rotations.
export function createUsStateProjection(): GeoProjection {
  let scale = 1070
  let translate: Point = [480, 250]
  let precision = Math.SQRT1_2
  let parts = usStateProjectionParts(scale, translate)
  let streams = new WeakMap<GeoStream, GeoStream>()
  function update() {
    parts = usStateProjectionParts(scale, translate)
    Object.values(parts).forEach(part => part.precision(precision))
    streams = new WeakMap()
  }
  function project(point: Point) {
    for (const part of Object.values(parts)) {
      const projected = part(point)
      if (projected && contains(part.clipExtent()!, projected)) return projected
    }
    return null
  }
  const result = Object.assign(project, {
    scale(value?: number) {
      if (value === undefined) return scale
      scale = value; update(); return result
    },
    translate(value?: Point) {
      if (value === undefined) return [...translate]
      translate = [...value]; update(); return result
    },
    precision(value?: number) {
      if (value === undefined) return precision
      precision = value; update(); return result
    },
    invert(point: Point) {
      const part = usStateInsets(scale, translate).find(inset => contains(inset.bounds, point))?.code
      return (part === 'AK' ? parts.alaska : part === 'HI' ? parts.hawaii : parts.mainland).invert!(point)
    },
    stream(output: GeoStream): GeoStream {
      const cached = streams.get(output)
      if (cached) return cached
      const inputs = Object.values(parts).map(part => part.stream(output))
      const stream: GeoStream = {
        point: (x, y, z) => inputs.forEach(input => input.point(x, y, z)),
        lineStart: () => inputs.forEach(input => input.lineStart()),
        lineEnd: () => inputs.forEach(input => input.lineEnd()),
        polygonStart: () => inputs.forEach(input => input.polygonStart()),
        polygonEnd: () => inputs.forEach(input => input.polygonEnd()),
        sphere: () => inputs.forEach(input => input.sphere?.()),
      }
      streams.set(output, stream)
      return stream
    },
    fitExtent(extent: Bounds, object: Parameters<GeoProjection['fitExtent']>[1]) {
      result.scale(150).translate([0, 0])
      const [[left, top], [right, bottom]] = geoPath(result).bounds(object)
      const width = extent[1][0] - extent[0][0], height = extent[1][1] - extent[0][1]
      const factor = Math.min(width / Math.max(1e-9, right - left), height / Math.max(1e-9, bottom - top))
      return result.scale(150 * factor).translate([
        extent[0][0] + (width - factor * (right + left)) / 2,
        extent[0][1] + (height - factor * (bottom + top)) / 2,
      ])
    },
    fitSize(size: Point, object: Parameters<GeoProjection['fitExtent']>[1]) {
      return result.fitExtent([[0, 0], size], object)
    },
  }) as unknown as GeoProjection
  return result
}
