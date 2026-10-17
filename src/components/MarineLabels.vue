<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useId, watch } from 'vue'
import { marineLabels, type MarineLabel } from '../data/marineLabels'
import { marineLabelPaths } from '../data/marineLabelPaths'
import { centeredLabelGuide, labelGuideLengths, sampleLabelGuide } from '../logic/marineLabelLayout'
import { locale } from '../i18n'
import type { MapPoint } from '../composables/useMapZoom'

const props = defineProps<{
  visible: boolean
  width: number
  height: number
  transform: Readonly<{ x: number; y: number; scale: number }>
  projectionScale: number
  projectPoint: (point: MapPoint) => MapPoint | undefined
  copyOffsets: readonly number[]
  wrapPeriod: number | null
}>()

interface ProjectedLabel extends MarineLabel {
  x: number
  y: number
  lines: string[]
  displayName: string
  guide?: MapPoint[]
  guideLengths?: number[]
  guideCenter?: number
  readableGuide?: MapPoint[]
  readableLengths?: number[]
  waterBounds?: [MapPoint, MapPoint]
  fontSize?: number
  spanFraction?: number
  sizeScale?: number
}

const groups = new Map<number, SVGGElement>()
const paths = new Map<string, SVGPathElement>()
const measurements = new Map<string, SVGTextElement>()
const measurementWidths = new Map<string, number>()
let measurementStyle = ''
let measurementGroup: SVGGElement | undefined
const pathPrefix = useId()
const collisionDebug = new URLSearchParams(window.location.search).has('water-label-debug')
const collisionReport = shallowRef<{ pairs: string[]; boxes: LabelBox[]; unmeasured: string[] }>({
  pairs: [], boxes: [], unmeasured: [],
})
const sampledGuides = new Map(Object.entries(marineLabelPaths)
  .map(([id, { points }]) => [id, sampleLabelGuide(points)]))
const readableGuides = new Map(Object.entries(marineLabelPaths)
  .flatMap(([id, { readablePoints }]) => readablePoints ? [[id, sampleLabelGuide(readablePoints)] as const] : []))
let updateFrame: number | undefined

function labelPathId(id: string, offset: number) {
  return `${pathPrefix}-${id}-${offset}`
}

function assignPath(element: unknown, id: string, offset: number) {
  const key = labelPathId(id, offset)
  if (element) paths.set(key, element as SVGPathElement)
  else paths.delete(key)
}

function assignMeasurement(element: unknown, id: string) {
  if (element) measurements.set(id, element as SVGTextElement)
  else measurements.delete(id)
}

function assignGroup(element: unknown, offset: number) {
  if (element) groups.set(offset, element as SVGGElement)
  else groups.delete(offset)
}

function labelLines(name: string, kind: string, horizontal = false) {
  if (horizontal && name.includes(' ')) {
    const words = name.split(' ')
    let split = 1
    for (let index = 2; index < words.length; index++) {
      const difference = (at: number) => Math.abs(words.slice(0, at).join(' ').length - words.slice(at).join(' ').length)
      if (difference(index) < difference(split)) split = index
    }
    return [words.slice(0, split).join(' '), words.slice(split).join(' ')]
  }
  const deliberateBreaks: Record<string, string[]> = {
    Atlanterhavet: ['Atlanter-', 'havet'],
    Stillehavet: ['Stille-', 'havet'],
    Indiahavet: ['India-', 'havet'],
    Nordishavet: ['Nordis-', 'havet'],
    Sargassohavet: ['Sargasso-', 'havet'],
    Kaspihavet: ['Kaspi-', 'havet'],
    Rødehavet: ['Røde-', 'havet'],
    Irskesjøen: ['Irske-', 'sjøen'],
    'Kotzebue Sound': ['Kotzebue', 'Sound'],
  }
  if (name in deliberateBreaks) return deliberateBreaks[name]
  if (kind !== 'ocean') return [name]
  if (/^(Atlantic|Pacific|Indian) Ocean$/.test(name)) return name.split(' ')
  return [name]
}

function projectGuide(source?: readonly MapPoint[], offset: MapPoint = [0, 0]): MapPoint[] | undefined {
  const shifted = offset[0] !== 0 || offset[1] !== 0
  // Taper placement nudges towards fixed corridor ends near the coast.
  const guide = source?.map(([x, y], index) => {
    const weight = shifted ? Math.sin(Math.PI * index / (source.length - 1)) ** 2 : 0
    return props.projectPoint([x + offset[0] * weight, y + offset[1] * weight])
  })
  // Keep date-line corridors continuous beside their wrapped map copies.
  if (guide && props.wrapPeriod) {
    for (let index = 1; index < guide.length; index++) {
      const previous = guide[index - 1], point = guide[index]
      if (previous && point) point[0] += Math.round((previous[0] - point[0]) / props.wrapPeriod) * props.wrapPeriod
    }
  }
  return guide?.every((point, index) => point?.every(Number.isFinite)
    && (props.wrapPeriod || index === 0 || Math.abs(point[0] - guide[index - 1]![0]!) < props.width / 2))
    ? guide as MapPoint[] : undefined
}

const projectedLabels = computed<ProjectedLabel[]>(() => marineLabels.flatMap((label) => {
  const placement = marineLabelPaths[label.id]
  // An unverified point anchor cannot keep enlarged text off nearby land.
  if (!placement && label.kind !== 'ocean') return []
  const offset = placement?.offset ?? [0, 0]
  const anchor = placement?.anchor ?? label.point
  const point = props.projectPoint([anchor[0] + offset[0], anchor[1] + offset[1]])
  if (!point || !point.every(Number.isFinite)) return []
  const displayName = locale.value === 'nb' ? label.nameNb : label.name
  const horizontal = placement?.layout === 'horizontal'
  const validGuide = horizontal ? undefined : projectGuide(sampledGuides.get(label.id), offset)
  const readableGuide = horizontal ? undefined : projectGuide(readableGuides.get(label.id), offset)
  const corners = placement?.bounds?.flatMap(([x]) => placement.bounds!.map(([, y]) =>
    props.projectPoint([x, y]),
  ))
  const waterBounds: [MapPoint, MapPoint] | undefined = corners?.every((point) => point?.every(Number.isFinite))
    ? [[Math.min(...corners.map((point) => point![0])), Math.min(...corners.map((point) => point![1]))],
      [Math.max(...corners.map((point) => point![0])), Math.max(...corners.map((point) => point![1]))]] : undefined
  return [{
    ...label,
    x: point[0],
    y: point[1],
    displayName,
    lines: validGuide ? [displayName] : labelLines(displayName, label.kind, horizontal),
    guide: validGuide,
    guideLengths: validGuide ? labelGuideLengths(validGuide) : undefined,
    guideCenter: marineLabelPaths[label.id]?.center,
    readableGuide,
    readableLengths: readableGuide ? labelGuideLengths(readableGuide) : undefined,
    waterBounds,
    fontSize: placement?.fontSize,
    spanFraction: placement?.spanFraction,
    sizeScale: placement?.sizeScale,
  }]
}))

function setVisible(element: SVGElement, visible: boolean) {
  const display = visible ? '' : 'none'
  if (element.style.display !== display) element.style.display = display
}

type LabelBox = [number, number, number, number]

function boxesIntersect(a: LabelBox, b: LabelBox) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
}

function updateCollisionReport(labels: Array<{ element: SVGTextElement; name: string }>) {
  // Diagnostic reads run only after placement settles and only with the URL
  // flag. Normal map use never measures individual characters.
  const viewport: LabelBox = [0, 0, props.width, props.height]
  const unmeasured = new Set<string>()
  const candidates = labels.flatMap((label) => {
    try {
      const bounds = label.element.getBBox()
      const box: LabelBox = [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height]
      return boxesIntersect(box, viewport) ? [{ ...label, box, letters: undefined as LabelBox[] | undefined }] : []
    } catch {
      unmeasured.add(label.name)
      return []
    }
  })
  function lettersFor(label: typeof candidates[number]) {
    if (label.letters) return label.letters
    label.letters = []
    try {
      const text = Array.from(label.element.children, (child) => child.textContent?.trim() ?? '').join('')
      for (let index = 0; index < label.element.getNumberOfChars(); index++) {
        if (/\s/.test(text[index] ?? '')) continue
        const bounds = label.element.getExtentOfChar(index)
        const box: LabelBox = [Math.max(0, bounds.x), Math.max(0, bounds.y),
          Math.min(props.width, bounds.x + bounds.width), Math.min(props.height, bounds.y + bounds.height)]
        if (box[0] < box[2] && box[1] < box[3]) label.letters.push(box)
      }
    } catch {
      unmeasured.add(label.name)
      label.letters = []
    }
    return label.letters
  }
  const pairs = new Set<string>()
  const boxes = new Map<string, LabelBox>()
  for (let first = 0; first < candidates.length; first++) {
    const a = candidates[first]!
    for (let second = first + 1; second < candidates.length; second++) {
      const b = candidates[second]!
      if (!boxesIntersect(a.box, b.box)) continue
      let touching = false
      for (const x of lettersFor(a)) for (const y of lettersFor(b)) {
        if (!boxesIntersect(x, y)) continue
        touching = true
        for (const box of [x, y]) boxes.set(box.join(','), box)
      }
      if (touching) pairs.add([a.name, b.name].sort().join(' ↔ '))
    }
  }
  collisionReport.value = { pairs: [...pairs].sort(), boxes: [...boxes.values()], unmeasured: [...unmeasured].sort() }
}

function updateLabels() {
  updateFrame = undefined
  if (!props.visible) return
  const scale = props.transform.scale
  // Natural Earth's label range is a cartographic zoom level, while this map
  // uses a free SVG scale. Include projection magnification so a fitted
  // regional view starts with appropriately local sea labels.
  const effectiveScale = Math.max(1, props.projectionScale * scale)
  const labelLevel = Math.min(9.9, 1 + 1.5 * Math.log2(effectiveScale))
  const baseFont = Math.max(12, Math.min(17, props.width / 65))
  // Normalize typography to the fitted geography, not the screen's font
  // floor. A narrow viewport fits a smaller world before camera zoom begins.
  const mapTypographyScale = props.projectionScale * props.width / 1600
  const fontSize = `${baseFont}px`
  // Measure every name with its actual font, case and spacing.
  // Batch these reads before placement writes, and only after gestures settle.
  if (measurementGroup) measurementGroup.style.fontSize = fontSize
  const styleKey = `${fontSize}:${locale.value}`
  if (styleKey !== measurementStyle) {
    measurementStyle = styleKey
    measurementWidths.clear()
  }
  for (const label of projectedLabels.value) {
    if ((!label.guide && !label.waterBounds && labelLevel < label.minLabel) || measurementWidths.has(label.id)) continue
    const element = measurements.get(label.id)
    const length = element ? Math.max(...Array.from(element.children,
      (line) => (line as SVGTextContentElement).getComputedTextLength())) : 0
    if (length) measurementWidths.set(label.id, length)
  }
  const visible = new Set<SVGElement>()
  const diagnosticLabels: Array<{ element: SVGTextElement; name: string }> = []
  const elements: SVGElement[] = []
  for (const offset of props.copyOffsets) {
    const group = groups.get(offset)
    if (!group) continue
    if (group.style.fontSize !== fontSize) group.style.fontSize = fontSize

    for (const [index, label] of projectedLabels.value.entries()) {
      const element = group.children.item(index) as SVGElement | null
      if (!element) continue
      elements.push(element)
      const isOcean = label.kind === 'ocean'
      const baseFontPixels = baseFont * (isOcean ? 1 : label.rank <= 2 ? 0.84 : 0.77)
      const baseTextWidth = measurementWidths.get(label.id)
      if (!baseTextWidth) continue
      const x = props.transform.x + scale * (label.x + offset)
      const y = props.transform.y + scale * label.y
      // Choose a size in the unzoomed map, then scale it exactly with the
      // geography. Fit the whole water corridor, never the zoomed viewport.
      // Geographic area sets the hierarchy without polar projection inflation.
      // Prepared water space remains the upper limit for coastline clearance.
      const areaSize = label.sizeScale !== undefined ? 17 * 0.6 * label.sizeScale : 20
      const preferredSize = Math.min(label.fontSize ?? Infinity, areaSize) * mapTypographyScale
      const paddedWidth = baseTextWidth + baseFontPixels * 2
      const corridorLengths = label.readableLengths ?? label.guideLengths
      const corridorSpace = corridorLengths
        ? (corridorLengths[corridorLengths.length - 1] ?? 0) * (label.spanFraction ?? 0.85)
        : label.waterBounds
          ? (label.waterBounds[1][0] - label.waterBounds[0][0]) * 0.85
          : (props.width - 20) * 0.8
      const heightFactor = label.waterBounds
        ? (label.waterBounds[1][1] - label.waterBounds[0][1]) * 0.7
          / (baseFontPixels * (label.lines.length > 1 ? 3.4 : 2.4))
        : Infinity
      const mapFontFactor = Math.min(preferredSize / baseFontPixels, corridorSpace / paddedWidth, heightFactor)
      const fontFactor = mapFontFactor * scale
      const fontPixels = baseFontPixels * fontFactor
      if (fontPixels < (isOcean ? 4 : 10)) continue
      const textWidth = baseTextWidth * fontFactor
      const halfWidth = textWidth / 2
      const halfHeight = fontPixels * (label.lines.length > 1 ? 1.2 : 0.7)
      const labelFont = `${fontPixels}px`
      if (element.style.fontSize !== labelFont) element.style.fontSize = labelFont
      let box: LabelBox
      if (label.guide && label.guideLengths) {
        // Keep the label at its geographic center even when only part of it
        // is in view. The map container clips the rendered text at its edges.
        const path = paths.get(labelPathId(label.id, offset))
        if (!path) continue
        const source = label.readableGuide && label.readableLengths
          ? { points: label.readableGuide, lengths: label.readableLengths }
          : { points: label.guide, lengths: label.guideLengths }
        const guide = centeredLabelGuide(source.points, source.lengths, paddedWidth * fontFactor / scale,
          label.guideCenter)
        if (!guide) continue
        element.style.fontSize = `${fontPixels}px`
        const screenPoints = guide.map(([x, y]) => [
          props.transform.x + scale * (x + offset),
          props.transform.y + scale * y,
        ] as MapPoint)
        path.setAttribute('d', screenPoints.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(''))
        const xs = screenPoints.map(([x]) => x)
        const ys = screenPoints.map(([, y]) => y)
        box = [Math.min(...xs) - fontPixels, Math.min(...ys) - fontPixels,
          Math.max(...xs) + fontPixels, Math.max(...ys) + fontPixels]
      } else {
        // Keep text in viewport coordinates, outside the scaled map group.
        // Firefox can otherwise soften labels while zooming the SVG scene.
        element.setAttribute('x', String(x))
        element.setAttribute('y', String(y))
        for (const line of Array.from(element.children)) line.setAttribute('x', String(x))
        box = [x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight]
      }
      if (label.waterBounds) {
        const [[left, top], [right, bottom]] = label.waterBounds
        const coastMargin = Math.max(10, fontPixels / 2)
        if (box[0] < props.transform.x + scale * (left + offset) + coastMargin
          || box[2] > props.transform.x + scale * (right + offset) - coastMargin
          || box[1] < props.transform.y + scale * top + coastMargin
          || box[3] > props.transform.y + scale * bottom - coastMargin) continue
      }
      // Prepared water space proves whether there is enough room at this
      // projection and zoom. Source zoom metadata must not hide a fitting name.
      const visibleBox: LabelBox = [Math.max(0, box[0]), Math.max(0, box[1]),
        Math.min(props.width, box[2]), Math.min(props.height, box[3])]
      const eligible = (label.guide !== undefined || label.waterBounds !== undefined || labelLevel >= label.minLabel)
        && visibleBox[0] < visibleBox[2] && visibleBox[1] < visibleBox[3]

      // Ocean and sea names may share water. Keep each eligible name visible
      // independently instead of letting another label's box suppress it.
      if (eligible) {
        visible.add(element)
        if (collisionDebug) diagnosticLabels.push({ element: element as SVGTextElement, name: label.displayName })
      }
    }
  }

  for (const element of elements) setVisible(element, visible.has(element))
  if (collisionDebug) updateCollisionReport(diagnosticLabels)
}

function scheduleUpdate() {
  if (!props.visible) return
  if (updateFrame === undefined) updateFrame = requestAnimationFrame(updateLabels)
}

watch(() => props.visible, (visible) => {
  if (updateFrame !== undefined) {
    cancelAnimationFrame(updateFrame)
    updateFrame = undefined
  }
  // Refresh positions before the first paint after a gesture, so stale
  // labels cannot flash at the old zoom level when they become visible.
  if (visible) updateLabels()
}, { flush: 'post' })

watch(
  () => [
    props.transform.x, props.transform.y, props.transform.scale,
    props.width, props.height, props.projectionScale,
    props.copyOffsets, projectedLabels.value,
  ],
  scheduleUpdate,
  { flush: 'post' },
)
function refreshFontMeasurements() {
  measurementWidths.clear()
  scheduleUpdate()
}

onMounted(() => {
  scheduleUpdate()
  document.fonts.addEventListener('loadingdone', refreshFontMeasurements)
})
onBeforeUnmount(() => {
  document.fonts.removeEventListener('loadingdone', refreshFontMeasurements)
  if (updateFrame !== undefined) cancelAnimationFrame(updateFrame)
})
</script>

<template>
  <!-- Preserve SVG text layout while hidden for gestures. The separate
       overlay remains noninteractive even when its opacity is zero. -->
  <g :opacity="visible ? 1 : 0" class="marine-labels" aria-hidden="true">
    <g :ref="(element) => { measurementGroup = element as SVGGElement | undefined }" visibility="hidden">
      <text
        v-for="label in projectedLabels"
        :key="label.id"
        :ref="(element) => assignMeasurement(element, label.id)"
        class="marine-label"
        :class="{ 'marine-label--ocean': label.kind === 'ocean', 'marine-label--small': label.rank >= 3 }"
      >
        <tspan v-for="(line, index) in label.lines" :key="index" x="0" :dy="index > 0 ? '1.35em' : undefined">
          {{ label.kind === 'ocean' ? line.toLocaleUpperCase(locale === 'nb' ? 'nb' : 'en') : line }}
        </tspan>
      </text>
    </g>
    <defs>
      <template v-for="offset in copyOffsets" :key="offset">
        <path
          v-for="label in projectedLabels.filter((label) => label.guide)"
          :id="labelPathId(label.id, offset)"
          :key="label.id"
          :ref="(element) => assignPath(element, label.id, offset)"
        />
      </template>
    </defs>
    <g
      v-for="offset in copyOffsets"
      :key="offset"
      :ref="(element) => assignGroup(element, offset)"
    >
      <text
        v-for="label in projectedLabels"
        :key="label.id"
        class="marine-label"
        :class="{ 'marine-label--ocean': label.kind === 'ocean', 'marine-label--small': label.rank >= 3 }"
        style="display: none"
      >
        <textPath v-if="label.guide" :href="`#${labelPathId(label.id, offset)}`" startOffset="50%">
          {{ label.kind === 'ocean' ? label.displayName.toLocaleUpperCase(locale === 'nb' ? 'nb' : 'en') : label.displayName }}
        </textPath>
        <tspan
          v-for="(line, index) in label.guide ? [] : label.lines"
          :key="index"
          :dy="index === 0 && label.lines.length > 1 ? '-0.55em' : index > 0 ? '1.35em' : undefined"
        >{{ label.kind === 'ocean' ? line.toLocaleUpperCase(locale === 'nb' ? 'nb' : 'en') : line }}</tspan>
      </text>
    </g>
  </g>
  <g v-if="collisionDebug && visible" class="water-label-diagnostics">
    <rect
      v-for="(box, index) in collisionReport.boxes" :key="index"
      :x="box[0]" :y="box[1]" :width="box[2] - box[0]" :height="box[3] - box[1]"
      fill="#e51c4640" stroke="#ba1238" stroke-width="1"
    />
    <foreignObject x="8" y="8" :width="Math.max(0, Math.min(420, width - 16))" :height="Math.max(0, Math.min(240, height - 16))">
      <div class="water-label-report" @pointerdown.stop @click.stop @dblclick.stop @wheel.stop @touchstart.stop @touchmove.stop>
        <strong>Water-name collisions: {{ collisionReport.pairs.length }}</strong>
        <p>Letter bounds overlap; this flags likely touching, not exact ink contact. Updates when the map settles.</p>
        <ul v-if="collisionReport.pairs.length">
          <li v-for="pair in collisionReport.pairs" :key="pair">{{ pair }}</li>
        </ul>
        <p v-else>No letter-bound overlaps detected in view.</p>
        <p v-if="collisionReport.unmeasured.length">Could not measure: {{ collisionReport.unmeasured.join(', ') }}</p>
      </div>
    </foreignObject>
  </g>
</template>

<style scoped>
.water-label-diagnostics {
  pointer-events: none;
}

.water-label-report {
  box-sizing: border-box;
  max-height: 100%;
  overflow: auto;
  padding: 10px;
  border: 1px solid #ba1238;
  border-radius: 8px;
  background: #fffdf5f2;
  color: #193943;
  font: 13px/1.4 system-ui, sans-serif;
  pointer-events: auto;
  user-select: text;
}

.water-label-report p, .water-label-report ul {
  margin: 6px 0 0;
}

.marine-labels {
  pointer-events: none;
  user-select: none;
}

.marine-label {
  fill: #24465a;
  fill-opacity: 0.74;
  font-family: var(--map-font-water);
  font-style: italic;
  font-size: 0.84em;
  font-weight: var(--ui-weight);
  letter-spacing: 0.11em;
  text-anchor: middle;
  dominant-baseline: middle;
}

.marine-label--ocean {
  font-size: 1em;
  font-weight: 600;
  letter-spacing: 0.25em;
}

.marine-label--small {
  font-size: 0.77em;
  fill-opacity: 0.65;
}
</style>
