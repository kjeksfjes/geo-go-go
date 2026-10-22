<script setup lang="ts">
import LoadingIndicator from './LoadingIndicator.vue'
import { t } from '../i18n'
defineProps<{ error?: Error }>()
function retry() { window.location.reload() }
</script>

<template>
  <div class="map-load-state">
    <div v-if="error" role="alert"><p>{{ t('mapLoadError') }}</p><button type="button" @click="retry">{{ t('retry') }}</button></div>
    <LoadingIndicator v-else :label="t('loadingMap')" />
  </div>
</template>

<style scoped>
.map-load-state { position: absolute; inset: 0; display: grid; place-items: center; background: var(--map-ocean); }
.map-load-state [role='alert'] { padding: 1rem; border-radius: var(--ui-radius-control); background: var(--ui-panel); color: var(--ui-text); }
.map-load-state button { padding: 0.5rem 0.75rem; font: inherit; cursor: pointer; }
</style>
