<script setup lang="ts">
import { onMounted, ref, type ComponentPublicInstance } from 'vue'
import TreeSelect from '@zanmato/vue3-treeselect'
import type { MapProjectionId } from '../composables/useMapProjection'
import { t } from '../i18n'

defineProps<{
  disabled?: boolean
  options: Array<{ id: MapProjectionId; label: string }>
}>()

const model = defineModel<MapProjectionId>({ required: true })
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
  // Keep the library's keyboard navigation while preventing text search.
  const input = (treeSelect.value?.$el as HTMLElement | undefined)
    ?.querySelector<HTMLInputElement>('.vue3-treeselect__input')
  if (input) {
    input.readOnly = true
    input.setAttribute('aria-labelledby', 'projection-selector-label')
  }
})

function selectProjection(value: string | null) {
  if (value !== null) {
    // Close before notifying the map, which may need an expensive rerender.
    const instance = treeSelect.value as ComponentPublicInstance & { closeMenu: () => void }
    instance.closeMenu()
    model.value = value as MapProjectionId
  }
}
</script>

<template>
  <div class="projection-selector" @mousedown.capture="toggleFromControl">
    <span id="projection-selector-label">{{ t('projection') }}</span>
    <TreeSelect
      ref="treeSelect"
      :model-value="model"
      :disabled="disabled"
      :options="options"
      :multiple="false"
      :disable-branch-nodes="false"
      :clearable="false"
      :backspace-removes="false"
      :delete-removes="false"
      :searchable="true"
      :close-on-select="true"
      :open-on-focus="false"
      :append-to-body="true"
      :max-height="320"
      aria-labelledby="projection-selector-label"
      @update:model-value="selectProjection"
    />
  </div>
</template>

<style scoped>
.projection-selector {
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

.projection-selector :deep(.vue3-treeselect) {
  width: 7.75rem;
  min-width: 7.75rem;
  color: #172d38;
  font: inherit;
}

.projection-selector :deep(.vue3-treeselect__control),
.projection-selector :deep(.vue3-treeselect--focused .vue3-treeselect__control),
.projection-selector :deep(.vue3-treeselect--open .vue3-treeselect__control) {
  height: 1.25rem;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.projection-selector :deep(.vue3-treeselect__single-value) {
  padding-left: 0;
  color: #172d38;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.25rem;
}

.projection-selector :deep(.vue3-treeselect--focused .vue3-treeselect__single-value) {
  color: #172d38;
}

.projection-selector :deep(.vue3-treeselect__input) {
  opacity: 0;
  cursor: pointer;
}

.projection-selector :deep(.vue3-treeselect__control),
.projection-selector :deep(.vue3-treeselect__input-container),
.projection-selector :deep(.vue3-treeselect--searchable .vue3-treeselect__value-container) {
  cursor: pointer;
}

.projection-selector :deep(.vue3-treeselect__control-arrow-container) {
  width: 1.1rem;
}

.projection-selector :deep(.vue3-treeselect__control-arrow) {
  color: #172d38;
}
</style>

<style>
html[data-input-modality='keyboard'] .projection-control:has(.vue3-treeselect__input:focus-visible) {
  outline: 2px solid rgba(23, 45, 56, 0.35);
  outline-offset: 2px;
}

/* Both popups are portaled; offset this one by its longer field label. */
body:has(.projection-control .vue3-treeselect--open) .vue3-treeselect__menu {
  transform: translateX(-4.9rem);
}
</style>
