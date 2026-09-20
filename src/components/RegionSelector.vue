<script setup lang="ts">
import { computed, onMounted, ref, type ComponentPublicInstance } from 'vue'
import TreeSelect from '@zanmato/vue3-treeselect'
import type { MapRegion, MapRegionId } from '../data/regions'
import { regionName, t } from '../i18n'

const props = defineProps<{
  options: readonly MapRegion[]
}>()

const model = defineModel<MapRegionId>({ required: true })
const treeSelect = ref<ComponentPublicInstance | null>(null)

function toggleFromControl(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  const instance = treeSelect.value as ComponentPublicInstance & {
    focusInput: () => void
    toggleMenu: () => void
  }
  instance.focusInput()
  instance.toggleMenu()
}

onMounted(() => {
  // In this release the library's non-searchable focus target does not wire
  // keyboard events. A read-only input keeps its built-in keyboard navigation
  // without exposing a search feature.
  const input = (treeSelect.value?.$el as HTMLElement | undefined)
    ?.querySelector<HTMLInputElement>('.vue3-treeselect__input')
  if (input) {
    input.readOnly = true
    input.setAttribute('aria-labelledby', 'region-selector-label')
  }
})

interface TreeOption {
  id: MapRegionId
  label: string
  children?: TreeOption[]
}

function toTreeOption(region: MapRegion): TreeOption {
  const option: TreeOption = { id: region.id, label: regionName(region) }
  if (region.children?.length) option.children = region.children.map(toTreeOption)
  return option
}

const treeOptions = computed(() => props.options.map(toTreeOption))

function selectRegion(value: string | null) {
  if (value !== null) model.value = value as MapRegionId
}
</script>

<template>
  <div class="region-selector" @mousedown.capture="toggleFromControl">
    <span id="region-selector-label">{{ t('region') }}</span>
    <TreeSelect
      ref="treeSelect"
      :model-value="model"
      :options="treeOptions"
      :multiple="false"
      :disable-branch-nodes="false"
      :clearable="false"
      :backspace-removes="false"
      :delete-removes="false"
      :searchable="true"
      :close-on-select="true"
      :default-expand-level="0"
      :open-on-focus="false"
      :append-to-body="true"
      :max-height="320"
      aria-labelledby="region-selector-label"
      @update:model-value="selectRegion"
    />
  </div>
</template>

<style scoped>
.region-selector {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.7rem;
  color: #52676e;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
}

.region-selector :deep(.vue3-treeselect) {
  width: 9rem;
  min-width: 7rem;
  color: #172d38;
  font: inherit;
}

.region-selector :deep(.vue3-treeselect__control),
.region-selector :deep(.vue3-treeselect--focused .vue3-treeselect__control),
.region-selector :deep(.vue3-treeselect--open .vue3-treeselect__control) {
  height: 1.25rem;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.region-selector :deep(.vue3-treeselect__single-value) {
  padding-left: 0;
  color: #172d38;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.25rem;
}

.region-selector :deep(.vue3-treeselect--focused .vue3-treeselect__single-value) {
  color: #172d38;
}

.region-selector :deep(.vue3-treeselect__input) {
  opacity: 0;
  cursor: pointer;
}

.region-selector :deep(.vue3-treeselect__control),
.region-selector :deep(.vue3-treeselect__input-container),
.region-selector :deep(.vue3-treeselect--searchable .vue3-treeselect__value-container) {
  cursor: pointer;
}

.region-selector :deep(.vue3-treeselect__control-arrow-container) {
  width: 1.1rem;
}

.region-selector :deep(.vue3-treeselect__control-arrow) {
  color: #172d38;
}

</style>

<style>
/* The library portals this menu to the body so the map cannot clip it. */
html[data-input-modality='keyboard'] .region-control:has(.vue3-treeselect__input:focus-visible) {
  outline: 2px solid rgba(23, 45, 56, 0.35);
  outline-offset: 2px;
}

.vue3-treeselect__menu {
  min-width: min(15.5rem, calc(100vw - 2rem));
  padding: 0.4rem;
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: 0 14px 32px rgba(23, 45, 56, 0.16);
  color: #172d38;
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.3;
  transform: translateX(-3.75rem);
}

/* Keep the extra width until the child rows actually leave the DOM on collapse. */
.vue3-treeselect__menu:has(.vue3-treeselect__indent-level-1) {
  min-width: min(calc(15.5rem + 15px), calc(100vw - 2rem));
}

.vue3-treeselect--open-below .vue3-treeselect__menu,
.vue3-treeselect--open-above .vue3-treeselect__menu {
  border-radius: 0.8rem;
  border-color: rgba(82, 103, 110, 0.18);
  box-shadow: 0 14px 32px rgba(23, 45, 56, 0.16);
}

.vue3-treeselect__option {
  display: flex;
  min-height: 2.4rem;
  flex-direction: row-reverse;
  align-items: center;
  margin: 1px 0;
  border-radius: 0.5rem;
}

.vue3-treeselect__option--highlight {
  background: #edf5f8;
}

.vue3-treeselect--single .vue3-treeselect__option--selected,
.vue3-treeselect--single .vue3-treeselect__option--selected:hover {
  color: #8f3522;
  background: #fceee9;
}

.vue3-treeselect__option-arrow-container,
.vue3-treeselect__option-arrow-placeholder {
  display: grid;
  width: 2.5rem;
  min-width: 2.5rem;
  height: 2.4rem;
  flex: none;
  place-items: center;
}

.vue3-treeselect__option-arrow {
  color: #52676e;
}

.vue3-treeselect__indent-level-0 .vue3-treeselect__option {
  padding-left: 0.15rem;
}

.vue3-treeselect__indent-level-1 .vue3-treeselect__option {
  padding-left: 1rem;
}

.vue3-treeselect__label-container {
  display: flex;
  min-width: 0;
  height: 2.4rem;
  flex: 1;
  align-items: center;
}

.vue3-treeselect__label {
  display: block;
  padding-left: 0.55rem;
}
</style>
