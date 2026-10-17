<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId, watch } from 'vue'
import { marineLabels, type MarineLabel } from '../data/marineLabels'
import { marineLabelPaths, type MarineLabelPath } from '../data/marineLabelPaths'
import { extendedLabelGuide, labelGuideLengths, sampleLabelGuide, startAlignedLabelGuide } from '../logic/marineLabelLayout'
import { waterLabelPlacements, waterLabelPlacementId } from '../logic/marineLabelPlacements'
import { spacedSvgTextWidth } from '../logic/svgTextMetrics'
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
  placements?: Record<string, MarineLabelPath>
  labels?: readonly MarineLabel[]
  editing?: boolean
  editingLabelId?: string
  editingPlacementIndex?: number
}>()
const emit = defineEmits<{
  select: [id: string, placementIndex: number]
  'editing-warning': [message: string]
  'editing-size': [size: { id: string; size: number; pixels: number; placementIndex: number }]
}>()
const placements = computed(() => props.placements ?? marineLabelPaths)

interface ProjectedLabel extends MarineLabel {
  waterId: string
  placementIndex: number
  x: number
  y: number
  lines: string[]
  displayName: string
  guide?: MapPoint[]
  guideLengths?: number[]
  guideCenter?: number
  guideTextPosition?: number
  readableGuide?: MapPoint[]
  readableLengths?: number[]
  waterBounds?: [MapPoint, MapPoint]
  fontSize?: number
  spanFraction?: number
  sizeScale?: number
  textScale?: number
  textSize?: number
  letterSpacing?: number
  rotation?: number
}

const groups = new Map<number, SVGGElement>()
const paths = new Map<string, SVGPathElement>()
const measurements = new Map<string, SVGTextElement>()
const measurementWidths = new Map<string, number>()
const measurementContents = new Map<string, string>()
let measurementStyle = ''
let measurementGroup: SVGGElement | undefined
let baselineContext: CanvasRenderingContext2D | null | undefined
const pathPrefix = useId()
const labelPlacements = computed(() => (props.labels ?? marineLabels).flatMap(label => {
  const root = placements.value[label.id]
  if (!root && label.kind !== 'ocean') return []
  return (root ? waterLabelPlacements(root) : [undefined]).map((placement, index) => ({
    label, placement, index, key: waterLabelPlacementId(label.id, index),
  }))
}))
const sampledGuides = computed(() => new Map(labelPlacements.value.flatMap(({ placement, key }) =>
  placement ? [[key, sampleLabelGuide(placement.points, placement.curve)] as const] : [])))
const readableGuides = computed(() => new Map(labelPlacements.value.flatMap(({ placement, key }) =>
  placement?.readablePoints ? [[key, sampleLabelGuide(placement.readablePoints, placement.curve)] as const] : [])))
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

const projectedLabels = computed<ProjectedLabel[]>(() => labelPlacements.value.flatMap(({ label, placement, index, key }) => {
  const offset = placement?.offset ?? [0, 0]
  // Each copy uses its own anchor, including when the source label lies outside this view.
  const anchorPoints = placement?.readablePoints ?? placement?.points
  const anchor = placement?.anchor ?? anchorPoints?.[Math.floor(anchorPoints.length / 2)] ?? label.point
  const point = props.projectPoint([anchor[0] + offset[0], anchor[1] + offset[1]])
  if (!point || !point.every(Number.isFinite)) return []
  const placementText = locale.value === 'nb' ? placement?.textNb : placement?.text
  const displayName = placementText ?? (locale.value === 'nb' ? label.nameNb : label.name)
  const horizontal = placement?.layout === 'horizontal'
  const stackedText = locale.value === 'nb' ? label.stackedTextNb : label.stackedText
  const validGuide = horizontal ? undefined : projectGuide(sampledGuides.value.get(key), offset)
  const readableGuide = horizontal ? undefined : projectGuide(readableGuides.value.get(key), offset)
  const corners = placement?.bounds?.flatMap(([x]) => placement.bounds!.map(([, y]) =>
    props.projectPoint([x, y]),
  ))
  const waterBounds: [MapPoint, MapPoint] | undefined = corners?.every((point) => point?.every(Number.isFinite))
    ? [[Math.min(...corners.map((point) => point![0])), Math.min(...corners.map((point) => point![1]))],
      [Math.max(...corners.map((point) => point![0])), Math.max(...corners.map((point) => point![1]))]] : undefined
  return [{
    ...label,
    id: key, waterId: label.id, placementIndex: index,
    x: point[0],
    y: point[1],
    displayName,
    lines: validGuide || placementText !== undefined ? [displayName] : horizontal && stackedText ? stackedText.split('\n') : labelLines(displayName, label.kind, horizontal),
    guide: validGuide,
    guideLengths: validGuide ? labelGuideLengths(validGuide) : undefined,
    guideCenter: placement?.center,
    guideTextPosition: placement?.textPosition,
    readableGuide,
    readableLengths: readableGuide ? labelGuideLengths(readableGuide) : undefined,
    waterBounds,
    fontSize: placement?.fontSize,
    spanFraction: placement?.spanFraction,
    sizeScale: placement?.sizeScale,
    textScale: placement?.textScale,
    textSize: placement?.textSize,
    letterSpacing: placement?.letterSpacing,
    rotation: placement?.rotation,
  }]
}))

function setVisible(element: SVGElement, visible: boolean) {
  const display = visible ? '' : 'none'
  if (element.style.display !== display) element.style.display = display
}

type LabelBox = [number, number, number, number]

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
  // Use ink metrics: SVG getBBox() includes the font's full text cell even
  // for "x", so its height is not the x-height and would push names downward.
  // Alphabetic baselines plus an explicit offset behave consistently on paths
  // and horizontal text. Lift the optical center by 0.2 of each label's size.
  if (baselineContext === undefined) baselineContext = document.createElement('canvas').getContext('2d')
  let xHeightEm = 0.4
  const baselineSample = measurementGroup?.querySelector('.marine-label:not(.marine-label--ocean)')
    ?? measurementGroup?.querySelector('text')
  if (baselineContext && baselineSample) {
    const style = getComputedStyle(baselineSample)
    baselineContext.font = `${style.fontStyle} ${style.fontWeight} 100px ${style.fontFamily}`
    const metrics = baselineContext.measureText('x')
    xHeightEm = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) / 100 || xHeightEm
  }
  const baselineOffsetEm = xHeightEm / 2 - 0.2
  const styleKey = `${fontSize}:${locale.value}`
  if (styleKey !== measurementStyle) {
    measurementStyle = styleKey
    measurementWidths.clear()
  }
  for (const label of projectedLabels.value) {
    const contents = JSON.stringify([label.lines, label.letterSpacing])
    if ((!label.guide && !label.waterBounds && labelLevel < label.minLabel)
      || (measurementWidths.has(label.id) && measurementContents.get(label.id) === contents)) continue
    measurementWidths.delete(label.id)
    const element = measurements.get(label.id)
    const length = element ? Math.max(...Array.from(element.children,
      (line) => spacedSvgTextWidth(line as SVGTextContentElement))) : 0
    if (length) {
      measurementWidths.set(label.id, length)
      measurementContents.set(label.id, contents)
    }
  }
  const visible = new Set<SVGElement>()
  const elements: SVGElement[] = []
  let editingWarning = ''
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
      // Fit the base size to prepared water space, then apply explicit manual
      // text scaling independently so the editor's size control stays useful.
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
          / (baseFontPixels * (label.lines.length > 1 ? 3.4 + (label.lines.length - 2) * 1.35 : 2.4))
        : Infinity
      let rotationFactor = Infinity
      if (label.rotation && label.waterBounds) {
        const angle = label.rotation * Math.PI / 180
        const cosine = Math.abs(Math.cos(angle)), sine = Math.abs(Math.sin(angle))
        const height = baseFontPixels * (label.lines.length > 1 ? 3.4 + (label.lines.length - 2) * 1.35 : 2.4)
        rotationFactor = Math.min(
          (label.waterBounds[1][0] - label.waterBounds[0][0]) * 0.7 / (paddedWidth * cosine + height * sine),
          (label.waterBounds[1][1] - label.waterBounds[0][1]) * 0.7 / (paddedWidth * sine + height * cosine),
        )
      }
      const mapFontFactor = label.textSize !== undefined
        ? label.textSize * mapTypographyScale / baseFontPixels
        : Math.min(preferredSize / baseFontPixels, corridorSpace / paddedWidth, heightFactor, rotationFactor)
          * (label.textScale ?? 1)
      const fontPixels = label.textSize !== undefined
        ? label.textSize * mapTypographyScale * scale
        : baseFontPixels * mapFontFactor * scale
      const fontFactor = fontPixels / baseFontPixels
      const selectedForEditing = props.editingLabelId === label.waterId
        && (props.editingPlacementIndex ?? 0) === label.placementIndex
      if (selectedForEditing) emit('editing-size', {
        id: label.waterId, placementIndex: label.placementIndex, size: label.textSize ?? fontPixels / scale / mapTypographyScale, pixels: fontPixels,
      })
      const keepVisible = props.editing && selectedForEditing
      if (fontPixels < (isOcean ? 4 : 10)) {
        if (selectedForEditing) editingWarning = 'Below the normal map visibility cutoff at this zoom. Zoom in or increase text size; hiding handles shows the normal map preview.'
        if (!keepVisible) continue
      }
      const textWidth = baseTextWidth * fontFactor
      const halfWidth = textWidth / 2
      const halfHeight = fontPixels * (label.lines.length > 1 ? 1.2 + (label.lines.length - 2) * 0.675 : 0.7)
      const labelFont = `${fontPixels}px`
      if (element.style.fontSize !== labelFont) element.style.fontSize = labelFont
      element.setAttribute('dy', `${baselineOffsetEm}em`)
      element.removeAttribute('transform')
      let box: LabelBox
      if (label.guide && label.guideLengths) {
        // Horizontal text leaves absolute coordinates on the shared <text>.
        // A textPath inherits those values and can start beyond its path.
        element.removeAttribute('x')
        element.removeAttribute('y')
        // Keep the label at its geographic center even when only part of it
        // is in view. The map container clips the rendered text at its edges.
        const path = paths.get(labelPathId(label.id, offset))
        if (!path) continue
        const source = label.readableGuide && label.readableLengths
          ? { points: label.readableGuide, lengths: label.readableLengths }
          : { points: label.guide, lengths: label.guideLengths }
        const guide = label.guideTextPosition === undefined
          ? extendedLabelGuide(source.points, source.lengths, paddedWidth * fontFactor / scale, label.guideCenter)
          : startAlignedLabelGuide(source.points, source.lengths, paddedWidth * fontFactor / scale,
            textWidth / scale, label.guideTextPosition)
        if (!guide) {
          if (selectedForEditing) editingWarning = 'The path has no usable length for this text. Extend the path or undo the last adjustment.'
          continue
        }
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
        if (label.rotation) {
          element.setAttribute('transform', `rotate(${label.rotation} ${x} ${y})`)
          const radians = label.rotation * Math.PI / 180
          const dx = Math.abs(halfWidth * Math.cos(radians)) + Math.abs(halfHeight * Math.sin(radians))
          const dy = Math.abs(halfWidth * Math.sin(radians)) + Math.abs(halfHeight * Math.cos(radians))
          box = [x - dx, y - dy, x + dx, y + dy]
        }
      }
      // An explicit size is an authored override, not a request to refit or
      // hide the text inside the old preparation rectangle. Apply this in
      // normal preview too, independent of selection and editor handles.
      if (label.waterBounds && label.textScale === undefined && label.textSize === undefined) {
        const [[left, top], [right, bottom]] = label.waterBounds
        const coastMargin = Math.max(10, fontPixels / 2)
        const outsideFrame = box[0] < props.transform.x + scale * (left + offset) + coastMargin
          || box[2] > props.transform.x + scale * (right + offset) - coastMargin
          || box[1] < props.transform.y + scale * top + coastMargin
          || box[3] > props.transform.y + scale * bottom - coastMargin
        if (outsideFrame) {
          if (selectedForEditing) editingWarning = 'Text exceeds its automatic fitting area. Reduce text size; hiding handles shows the normal map preview.'
          if (!keepVisible) continue
        }
      }
      // Prepared water space proves whether there is enough room at this
      // projection and zoom. Source zoom metadata must not hide a fitting name.
      const visibleBox: LabelBox = [Math.max(0, box[0]), Math.max(0, box[1]),
        Math.min(props.width, box[2]), Math.min(props.height, box[3])]
      const eligible = (label.guide !== undefined || label.waterBounds !== undefined || labelLevel >= label.minLabel)
        && visibleBox[0] < visibleBox[2] && visibleBox[1] < visibleBox[3]

      // Ocean and sea names may share water. Keep each eligible name visible
      // independently instead of letting another label's box suppress it.
      if (eligible) visible.add(element)
    }
  }

  for (const element of elements) setVisible(element, visible.has(element))
  emit('editing-warning', editingWarning)
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
    // Switching copies keeps the water ID, but still needs a draw pass after
    // Vue patches the text nodes' initial display styles and selection state.
    props.editing, props.editingLabelId, props.editingPlacementIndex,
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
  <g :opacity="visible ? 1 : 0" class="marine-labels" :class="{ 'marine-labels--editing': editing }" aria-hidden="true">
    <g :ref="(element) => { measurementGroup = element as SVGGElement | undefined }" visibility="hidden">
      <text
        v-for="label in projectedLabels"
        :key="label.id"
        :ref="(element) => assignMeasurement(element, label.id)"
        class="marine-label"
        :style="{ letterSpacing: label.letterSpacing === undefined ? undefined : `${label.letterSpacing}em` }"
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
        :style="{ letterSpacing: label.letterSpacing === undefined ? undefined : `${label.letterSpacing}em` }"
        @pointerdown.stop.prevent="editing && emit('select', label.waterId, label.placementIndex)"
      >
        <textPath v-if="label.guide" :href="`#${labelPathId(label.id, offset)}`" startOffset="50%">
          {{ label.kind === 'ocean' ? label.displayName.toLocaleUpperCase(locale === 'nb' ? 'nb' : 'en') : label.displayName }}
        </textPath>
        <tspan
          v-for="(line, index) in label.guide ? [] : label.lines"
          :key="index"
          :dy="index === 0 && label.lines.length > 1 ? `${-0.55 - (label.lines.length - 2) * 0.675}em` : index > 0 ? '1.35em' : undefined"
        >{{ label.kind === 'ocean' ? line.toLocaleUpperCase(locale === 'nb' ? 'nb' : 'en') : line }}</tspan>
      </text>
    </g>
  </g>
</template>

<style scoped>
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
}

/* Set child baselines explicitly: WebKit has differed when inheriting middle. */
.marine-label, .marine-label tspan, .marine-label textPath { dominant-baseline: alphabetic; }

.marine-labels--editing .marine-label { pointer-events: visiblePainted; cursor: pointer; }

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
