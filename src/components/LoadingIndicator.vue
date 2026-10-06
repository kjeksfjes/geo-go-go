<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue'

defineProps<{
  label: string
}>()
</script>

<template>
  <p class="loading-indicator" role="status">
    <LoadingSpinner />
    <span>{{ label }}</span>
  </p>
</template>

<style scoped>
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin: 0;
  padding: 0.7rem 1rem;
  border-radius: var(--ui-radius-control);
  color: var(--ui-text);
  background: var(--ui-panel);
  box-shadow: var(--ui-shadow-panel);
  font-size: var(--ui-text-control);
  font-weight: var(--ui-weight);
}
</style>
