<script setup lang="ts">
import { computed } from 'vue'
import TreeSelect from '@zanmato/vue3-treeselect'
import type { MapRegion, MapRegionId } from '../data/regions'
import { regionName, t } from '../i18n'
import { useMapTreeSelectControl } from '../composables/useMapTreeSelectControl'

const props = defineProps<{
  options: readonly MapRegion[]
}>()

const model = defineModel<MapRegionId>({ required: true })
const { treeSelect, toggleFromControl, startAligning, stopAligning } =
  useMapTreeSelectControl('region-selector', '.header-region-control', 'region-selector-label', 'bottom')

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
  <div class="map-select-field region-selector" @mousedown.capture="toggleFromControl">
    <span id="region-selector-label">{{ t('region') }}</span>
    <TreeSelect
      ref="treeSelect"
      instance-id="region-selector"
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
      open-direction="bottom"
      :max-height="320"
      aria-labelledby="region-selector-label"
      @open="startAligning"
      @close="stopAligning"
      @update:model-value="selectRegion"
    />
  </div>
</template>

<style scoped>
.region-selector {
  --map-select-width: 8rem;
}
</style>
