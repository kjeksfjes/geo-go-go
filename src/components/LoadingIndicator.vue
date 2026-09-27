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
  border-radius: 999px;
  color: #52676e;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 8px 24px rgb(23 45 56 / 14%);
  font-size: 0.8rem;
  font-weight: 750;
}
</style>
