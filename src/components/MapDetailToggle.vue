<script setup lang="ts">
import { useId } from 'vue'
import { t } from '../i18n'
import LoadingSpinner from './LoadingSpinner.vue'

const props = withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
  modelValue: boolean
  label?: string
  context?: string
  description?: string
}>(), {
  loading: false,
  disabled: false,
})

const descriptionId = `setting-description-${useId()}`

const emit = defineEmits<{
  'update:modelValue': [enabled: boolean]
}>()
</script>

<template>
  <button
    class="detail-toggle"
    :class="{ 'detail-toggle--active': modelValue, 'detail-toggle--described': context || description }"
    type="button"
    role="switch"
    :aria-label="label ?? t('highDetail')"
    :aria-describedby="context || description ? descriptionId : undefined"
    :aria-checked="modelValue"
    :aria-busy="loading"
    :disabled="loading || disabled"
    @click="emit('update:modelValue', !props.modelValue)"
  >
    <span class="detail-toggle__text">
      <span>{{ label ?? t('highDetail') }}</span>
      <span v-if="context || description" :id="descriptionId" class="detail-toggle__help">
        <span v-if="context" class="detail-toggle__context">{{ context }}</span>
        <span v-if="description" class="detail-toggle__description">{{ description }}</span>
      </span>
    </span>
    <span class="detail-toggle__indicator" aria-hidden="true">
      <LoadingSpinner v-if="loading" />
      <span v-else class="detail-toggle__track">
        <span class="detail-toggle__thumb" />
      </span>
    </span>
  </button>
</template>

<style scoped>
.detail-toggle {
  display: flex;
  align-items: center;
  min-height: var(--ui-control-height);
  gap: 0.55rem;
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-control);
  color: var(--ui-text);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-control);
  font: inherit;
  font-size: var(--ui-text-control);
  font-weight: var(--ui-weight);
  white-space: nowrap;
  cursor: pointer;
}

:global(html[data-input-modality='keyboard'] .detail-toggle:focus-visible) {
  outline: 2px solid var(--ui-focus);
  outline-offset: 2px;
}

.detail-toggle__text { flex: 1; min-width: 0; text-align: left; }
.detail-toggle--described { align-items: flex-start; white-space: normal; }
.detail-toggle--described .detail-toggle__indicator { margin-top: 0.15rem; }
.detail-toggle__help { display: grid; gap: var(--ui-space-1); margin-top: var(--ui-space-2); font-size: var(--ui-text-small); line-height: 1.4; }
.detail-toggle__context { color: var(--ui-muted); font-weight: var(--ui-weight); }
.detail-toggle__description { color: var(--ui-muted); font-weight: var(--ui-weight); }

.detail-toggle:disabled {
  cursor: default;
}

.detail-toggle__indicator {
  --loading-spinner-size: 1rem;
  display: grid;
  width: 1.8rem;
  height: 1rem;
  flex: none;
  place-items: center;
}

.detail-toggle__track {
  position: relative;
  display: block;
  width: 1.8rem;
  height: 1rem;
  border-radius: 999px;
  background: var(--ui-border-strong);
  transition: background 140ms ease;
}

.detail-toggle__thumb {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--ui-surface);
  box-shadow: 0 1px 3px rgba(23, 45, 56, 0.3);
  transition: transform 140ms ease;
}

.detail-toggle--active .detail-toggle__track {
  background: var(--ui-accent);
}

.detail-toggle--active .detail-toggle__thumb {
  transform: translateX(0.8rem);
}

@media (prefers-reduced-motion: reduce) {
  .detail-toggle__track,
  .detail-toggle__thumb {
    transition: none;
  }
}
</style>
