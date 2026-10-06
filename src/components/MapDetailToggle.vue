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
  gap: 0.55rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 999px;
  color: #52676e;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 3px 12px rgba(23, 45, 56, 0.08);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  backdrop-filter: blur(7px);
}

:global(html[data-input-modality='keyboard'] .detail-toggle:focus-visible) {
  outline: 2px solid rgba(23, 45, 56, 0.35);
  outline-offset: 2px;
}

.detail-toggle__text { flex: 1; min-width: 0; text-align: left; }
.detail-toggle--described { align-items: flex-start; white-space: normal; }
.detail-toggle--described .detail-toggle__indicator { margin-top: 0.15rem; }
.detail-toggle__help { display: grid; gap: 0.3rem; margin-top: 0.4rem; font-size: 0.72rem; line-height: 1.4; }
.detail-toggle__context { color: #687a80; font-weight: 650; }
.detail-toggle__description { color: #687678; font-weight: 400; }

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
  background: #b8c3c5;
  transition: background 140ms ease;
}

.detail-toggle__thumb {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(23, 45, 56, 0.3);
  transition: transform 140ms ease;
}

.detail-toggle--active .detail-toggle__track {
  background: #e76f51;
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
