<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'
import {
  ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput,
  ComboboxItem, ComboboxPortal, ComboboxRoot, ComboboxViewport,
} from 'reka-ui'
import { countryName, locale, t } from '../i18n'
import { filterCountrySuggestions, normalizeCountrySearch } from '../logic/countrySuggestions'

const props = defineProps<{ countryIds: readonly string[]; answerId: string | null; correct: boolean }>()
const emit = defineEmits<{ answer: [countryId: string] }>()
const root = ref<HTMLElement | null>(null)
const inputId = `country-answer-${useId()}`
const search = ref('')
const open = ref(false)
const suggestions = computed(() => filterCountrySuggestions(
  props.countryIds.map((id) => ({ id, name: countryName(id) })), search.value, locale.value,
))

function selectCountry(value: unknown) {
  if (!normalizeCountrySearch(search.value) || typeof value !== 'string' || !props.countryIds.includes(value)) return
  open.value = false
  emit('answer', value)
}

function setOpen(value: boolean) { open.value = value && !!normalizeCountrySearch(search.value) }
watch(search, (value) => { open.value = !!normalizeCountrySearch(value) }, { flush: 'post' })

watch(locale, () => { search.value = ''; open.value = false })

onMounted(() => {
  // Let phone users inspect the map before opening the software keyboard.
  if (!props.answerId && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    root.value?.querySelector('input')?.focus({ preventScroll: true })
  }
})
</script>

<template>
  <div ref="root" class="country-answer">
    <label :for="inputId" class="country-answer__label">{{ t('yourGuess') }}</label>
    <div v-if="answerId" class="country-answer__anchor" :class="correct ? 'country-answer__anchor--correct' : 'country-answer__anchor--wrong'">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path v-if="correct" d="m5 12 4 4 10-10" /><path v-else d="m6 6 12 12 M6 18 18 6" />
      </svg>
      <input
        :id="inputId"
        class="country-answer__input"
        :value="countryName(answerId)"
        data-1p-ignore
        data-bwignore="true"
        data-lpignore="true"
        data-form-type="other"
        readonly
      />
    </div>
    <ComboboxRoot
      v-else
      :open="open"
      :open-on-click="false"
      @update:open="setOpen"
      :model-value="null"
      :ignore-filter="true"
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      :loop="true"
      @update:model-value="selectCountry"
    >
      <ComboboxAnchor class="country-answer__anchor">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
        </svg>
        <ComboboxInput
          :id="inputId"
          v-model="search"
          class="country-answer__input"
          data-1p-ignore
          data-bwignore="true"
          data-lpignore="true"
          data-form-type="other"
          :aria-label="t('yourGuess')"
          :placeholder="t('countryNamePlaceholder')"
          autocorrect="off"
          autocapitalize="none"
          :spellcheck="false"
          enterkeyhint="go"
        />
      </ComboboxAnchor>
      <ComboboxPortal>
        <ComboboxContent class="country-suggestions" position="popper" :side-offset="6" :collision-padding="12" :aria-label="t('countrySuggestions')">
          <ComboboxViewport class="country-suggestions__viewport">
            <ComboboxEmpty class="country-suggestions__empty">{{ t('noCountryMatches') }}</ComboboxEmpty>
            <ComboboxItem v-for="option in suggestions" :key="option.id" :value="option.id" :text-value="option.name" class="country-suggestions__item">
              {{ option.name }}
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
    <p v-if="!answerId" class="country-answer__hint">{{ t('countryAnswerHint') }}</p>
  </div>
</template>

<style scoped>
.country-answer { min-width: 0; }
.country-answer__label { display: block; margin-bottom: 0.35rem; color: #52676e; font-size: 0.8rem; font-weight: 650; }
.country-answer__anchor {
  display: flex; align-items: center; gap: 0.65rem;
  border: 1px solid #b4c4c9; border-radius: 12px; padding: 0.65rem 0.8rem;
  color: #687a80; background: #fff;
}
.country-answer__anchor--correct { border-color: #76a68b; background: #f5fbf7; color: #26774a; }
.country-answer__anchor--wrong { border-color: #cf887c; background: #fff8f5; color: #a13d2c; }
.country-answer__anchor:focus-within { border-color: #315d6d; box-shadow: 0 0 0 3px rgb(49 93 109 / 12%); }
.country-answer__input { width: 100%; min-width: 0; border: 0; outline: none; background: transparent; color: #172d38; font: inherit; font-size: 1rem; }
.country-answer__input::placeholder { color: #83949b; }
.country-answer__hint { margin: 0.4rem 0 0; color: #687678; font-size: 0.73rem; }
</style>

<!-- The portaled content wrapper does not inherit this component’s scope ID. -->
<style>
.country-suggestions {
  z-index: 20; width: var(--reka-combobox-trigger-width);
  max-height: min(260px, var(--reka-combobox-content-available-height, 260px)); overflow: hidden;
  border: 1px solid #c6d4d9; border-radius: 12px; padding: 0.3rem;
  background: #fff; color: #172d38; box-shadow: 0 12px 30px rgb(23 45 56 / 18%);
}
.country-suggestions__viewport { min-height: 0; max-height: inherit; overflow-y: auto; overscroll-behavior: contain; }
.country-suggestions__item { padding: 0.7rem 0.8rem; border-radius: 8px; font-size: 0.94rem; cursor: pointer; outline: none; }
.country-suggestions__item[data-highlighted] { background: #e6eff2; color: #17374b; }
.country-suggestions__empty { padding: 0.75rem; color: #687678; font-size: 0.85rem; }
</style>
