<script setup lang="ts">
import { computed } from 'vue'
import TreeSelect from '@zanmato/vue3-treeselect'
import type { MapProjectionId, MapProjectionOption } from '../composables/useMapProjection'
import { useMapTreeSelectControl } from '../composables/useMapTreeSelectControl'
import { t } from '../i18n'

const props = defineProps<{
  disabled?: boolean
  options: MapProjectionOption[]
}>()

const model = defineModel<MapProjectionId>({ required: true })
const localizedOptions = computed(() => props.options.map((option) =>
  option.id === 'regional-equal-area'
    ? { ...option, label: t('regionalEqualArea') }
    : option,
))
const { treeSelect, toggleFromControl, closeMenu, startAligning, stopAligning } =
  useMapTreeSelectControl('projection-selector', '.projection-control', 'projection-selector-label', 'bottom')

function selectProjection(value: string | null) {
  if (value !== null) {
    // Close before notifying the map, which may need an expensive rerender.
    closeMenu()
    model.value = value as MapProjectionId
  }
}
</script>

<template>
  <div class="map-select-field projection-selector" @mousedown.capture="toggleFromControl">
    <span id="projection-selector-label">{{ t('projection') }}</span>
    <TreeSelect
      ref="treeSelect"
      instance-id="projection-selector"
      :model-value="model"
      :disabled="disabled"
      :options="localizedOptions"
      :multiple="false"
      :disable-branch-nodes="false"
      :clearable="false"
      :backspace-removes="false"
      :delete-removes="false"
      :searchable="true"
      :close-on-select="true"
      :open-on-focus="false"
      :append-to-body="true"
      open-direction="bottom"
      :max-height="320"
      aria-labelledby="projection-selector-label"
      @open="startAligning"
      @close="stopAligning"
      @update:model-value="selectProjection"
    />
  </div>
</template>

<style scoped>
.projection-selector {
  --map-select-width: 10rem;
}
</style>
