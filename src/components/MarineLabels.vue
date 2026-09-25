<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { marineLabels, type MarineLabel } from '../data/marineLabels'
import { locale } from '../i18n'
import type { HorizontalWrap } from '../composables/useMapProjection'
import type { MapPoint } from '../composables/useMapZoom'

const props = defineProps<{
  visible: boolean
  width: number
  height: number
  transform: Readonly<{ x: number; y: number; scale: number }>
  projectionScale: number
  projectPoint: (point: MapPoint) => MapPoint | undefined
  wrap: HorizontalWrap | null
  wrapActive: boolean
  wrapDirection: number
}>()

interface ProjectedLabel extends MarineLabel {
  x: number
  y: number
  lines: string[]
  displayName: string
}

const primaryGroup = ref<SVGGElement | null>(null)
const wrappedGroup = ref<SVGGElement | null>(null)
let updateFrame: number | undefined

function assignGroup(element: unknown, copyIndex: number) {
  if (copyIndex === 0) primaryGroup.value = element as SVGGElement | null
  else wrappedGroup.value = element as SVGGElement | null
}

function labelLines(name: string, kind: string) {
  if (kind !== 'ocean') return [name]
  const norwegianBreaks: Record<string, string[]> = {
    Atlanterhavet: ['Atlanter-', 'havet'],
    Stillehavet: ['Stille-', 'havet'],
    Indiahavet: ['India-', 'havet'],
  }
  if (name in norwegianBreaks) return norwegianBreaks[name]
  if (/^(Atlantic|Pacific|Indian) Ocean$/.test(name)) return name.split(' ')
  return [name]
}

const projectedLabels = computed<ProjectedLabel[]>(() => marineLabels.flatMap((label) => {
  const point = props.projectPoint(label.point)
  if (!point || !point.every(Number.isFinite)) return []
  const displayName = locale.value === 'nb' ? label.nameNb ?? label.name : label.name
  return [{
    ...label,
    x: point[0],
    y: point[1],
    displayName,
    lines: labelLines(displayName, label.kind),
  }]
}))

function setVisible(element: SVGElement, visible: boolean) {
  const display = visible ? '' : 'none'
  if (element.style.display !== display) element.style.display = display
}

interface Candidate {
  element: SVGElement
  rank: number
  box: [number, number, number, number]
}

function intersects(a: Candidate['box'], b: Candidate['box']) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
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
  const fontSize = `${baseFont / scale}px`
  const candidates: Candidate[] = []
  const elements: SVGElement[] = []
  const groups = [primaryGroup.value, props.wrapActive ? wrappedGroup.value : null]

  for (const [copyIndex, group] of groups.entries()) {
    if (!group) continue
    if (group.style.fontSize !== fontSize) group.style.fontSize = fontSize
    const offset = copyIndex === 1 && props.wrap
      ? props.wrapDirection * props.wrap.period
      : 0

    for (const [index, label] of projectedLabels.value.entries()) {
      const element = group.children.item(index) as SVGElement | null
      if (!element) continue
      elements.push(element)
      const isOcean = label.kind === 'ocean'
      const fontPixels = baseFont * (isOcean ? 1 : label.rank <= 2 ? 0.84 : 0.77)
      const longestLine = Math.max(...label.lines.map((line) => line.length))
      const halfWidth = longestLine * (fontPixels * 0.55 + (isOcean ? 2.2 : 1)) / 2
      const halfHeight = label.lines.length > 1 ? baseFont * 1.2 : fontPixels * 0.7
      const x = props.transform.x + scale * (label.x + offset)
      const y = props.transform.y + scale * label.y
      const box: Candidate['box'] = [x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight]
      const eligible = labelLevel >= label.minLabel
        && labelLevel <= label.maxLabel
        && box[0] >= 10 && box[2] <= props.width - 10
        && box[1] >= 58 && box[3] <= props.height - 12

      if (eligible) candidates.push({ element, rank: label.rank, box })
    }
  }

  // Larger water bodies win when names compete for the same space. Collision
  // checks happen in screen pixels, so the result stays legible at every zoom.
  candidates.sort((a, b) => a.rank - b.rank)
  const placed: Candidate['box'][] = []
  const visible = new Set<SVGElement>()
  for (const candidate of candidates) {
    if (placed.some((box) => intersects(candidate.box, box))) continue
    visible.add(candidate.element)
    placed.push(candidate.box)
  }
  for (const element of elements) setVisible(element, visible.has(element))
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
    props.wrapActive, props.wrapDirection, projectedLabels.value,
  ],
  scheduleUpdate,
  { flush: 'post' },
)
onMounted(scheduleUpdate)
onBeforeUnmount(() => {
  if (updateFrame !== undefined) cancelAnimationFrame(updateFrame)
})
</script>

<template>
  <g v-show="visible" class="marine-labels" aria-hidden="true">
    <g
      v-for="copyIndex in [0, 1]"
      :key="copyIndex"
      :ref="(element) => assignGroup(element, copyIndex)"
      v-show="copyIndex === 0 || wrapActive"
      :transform="copyIndex === 1 && wrap ? `translate(${wrapDirection * wrap.period} 0)` : undefined"
    >
      <text
        v-for="label in projectedLabels"
        :key="label.id"
        :x="label.x"
        :y="label.y"
        class="marine-label"
        :class="{ 'marine-label--ocean': label.kind === 'ocean', 'marine-label--small': label.rank >= 3 }"
        style="display: none"
      >
        <tspan
          v-for="(line, index) in label.lines"
          :key="index"
          :x="label.x"
          :dy="index === 0 && label.lines.length > 1 ? '-0.55em' : index > 0 ? '1.35em' : undefined"
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
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 0.84em;
  font-weight: 600;
  letter-spacing: 0.11em;
  text-anchor: middle;
  dominant-baseline: middle;
}

.marine-label--ocean {
  font-size: 1em;
  font-weight: 650;
  letter-spacing: 0.25em;
}

.marine-label--small {
  font-size: 0.77em;
  fill-opacity: 0.65;
}
</style>
