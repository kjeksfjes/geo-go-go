<script setup lang="ts">
import type { MapProjectionId } from '../composables/useMapProjection'

defineProps<{
  options: Array<{ id: MapProjectionId; label: string }>
}>()

const model = defineModel<MapProjectionId>({ required: true })
</script>

<template>
  <label class="projection-selector">
    <span>Projection</span>
    <select v-model="model">
      <option v-for="option in options" :key="option.id" :value="option.id">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.projection-selector {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: #52676e;
  font-size: 0.72rem;
  font-weight: 700;
}

.projection-selector select {
  border: 0;
  outline: none;
  color: #172d38;
  background: transparent;
  cursor: pointer;
}

.projection-selector:focus-within {
  outline: 2px solid rgba(23, 45, 56, 0.35);
  outline-offset: 2px;
}
</style>
