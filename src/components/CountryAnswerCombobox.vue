<script setup lang="ts">
import { placeText } from '../logic/placeText'
import type { PlaceKind } from '../types/administrativeMap'
import { computed, onMounted, ref, useId, watch } from 'vue'
import {
  ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput,
  ComboboxItem, ComboboxPortal, ComboboxRoot, ComboboxViewport,
} from 'reka-ui'
import { countryName, locale, t, type MessageKey } from '../i18n'
import { countryInfoById } from '../data/countries'
import type { QuizTipAction } from '../logic/quizTips'
import { filterCountrySuggestions, normalizeCountrySearch } from '../logic/countrySuggestions'

const props = defineProps<{ countryIds: readonly string[]; answerId: string | null; correct: boolean; names?: Readonly<Record<string, string>>; badges?: Readonly<Record<string, string>>; aliases?: Readonly<Record<string, readonly string[]>>; placeKind?: PlaceKind }>()
function displayName(id: string) { return props.names ? props.names[id] ?? id : countryName(id) }
function text(key: MessageKey, values: Record<string, string | number> = {}) {
  return placeText(props.placeKind ?? 'country', key, values)
}
const emit = defineEmits<{ answer: [countryId: string]; 'tip-action': [action: QuizTipAction] }>()
let selectionMethod: 'keyboard' | 'pointer' = 'keyboard'
let selectionPointerType = 'mouse'
function recordKeys(event: KeyboardEvent) {
  selectionMethod = 'keyboard'
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) emit('tip-action', 'typed')
}
function recordSuggestionPointer(event: PointerEvent) {
  selectionMethod = 'pointer'
  selectionPointerType = event.pointerType
}
function handleFieldPointer(event: PointerEvent) {
  selectionMethod = 'pointer'
  selectionPointerType = event.pointerType
  if (event.pointerType === 'touch') emit('tip-action', 'field-touch')
}
const root = ref<HTMLElement | null>(null)
const inputId = `country-answer-${useId()}`
const search = defineModel<string>('search', { required: true })
const open = ref(false)
const suggestions = computed(() => filterCountrySuggestions(
  props.countryIds.map((id) => ({ id, name: displayName(id), aliases: props.aliases?.[id] })), search.value, locale.value,
))

function selectCountry(value: unknown) {
  if (!normalizeCountrySearch(search.value) || typeof value !== 'string' || !props.countryIds.includes(value)) return
  open.value = false
  emit('tip-action', selectionMethod === 'keyboard' ? 'answer-keyboard' : 'answer-pointer')
  if (selectionMethod === 'pointer' && selectionPointerType === 'touch') {
    emit('tip-action', 'answer-touch')
  }
  emit('answer', value)
}

function setOpen(value: boolean) { open.value = value && !!normalizeCountrySearch(search.value) }
watch(search, (value) => { open.value = !!normalizeCountrySearch(value) }, { flush: 'post' })

watch(locale, () => { search.value = ''; open.value = false })

function focusInput() {
  if (!props.answerId) root.value?.querySelector('input')?.focus({ preventScroll: true })
}

defineExpose({ focusInput })

onMounted(() => {
  // Let phone users inspect the map before opening the software keyboard.
  if (!props.answerId && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    focusInput()
  }
})
</script>

<template>
  <div ref="root" class="country-answer" @keydown.capture="recordKeys">
    <label :for="inputId" class="country-answer__label">{{ t('yourGuess') }}</label>
    <div v-if="answerId" class="country-answer__anchor" :class="correct ? 'country-answer__anchor--correct' : 'country-answer__anchor--wrong'">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path v-if="correct" d="m5 12 4 4 10-10" /><path v-else d="m6 6 12 12 M6 18 18 6" />
      </svg>
      <input
        :id="inputId"
        class="country-answer__input"
        :value="displayName(answerId)"
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
          @pointerdown="handleFieldPointer"
          v-model="search"
          class="country-answer__input"
          data-1p-ignore
          data-bwignore="true"
          data-lpignore="true"
          data-form-type="other"
          :aria-label="t('yourGuess')"
          :placeholder="text('countryNamePlaceholder')"
          autocorrect="off"
          autocapitalize="none"
          :spellcheck="false"
          enterkeyhint="go"
        />
      </ComboboxAnchor>
      <ComboboxPortal>
        <ComboboxContent @pointerdown.capture="recordSuggestionPointer" @keydown.capture="recordKeys" class="country-suggestions" position="popper" :side-offset="6" :collision-padding="12" :aria-label="text('countrySuggestions')">
          <ComboboxViewport class="country-suggestions__viewport">
            <ComboboxEmpty class="country-suggestions__empty">{{ text('noCountryMatches') }}</ComboboxEmpty>
            <ComboboxItem v-for="option in suggestions" :key="option.id" :value="option.id" :text-value="option.name" class="country-suggestions__item">
              <img v-if="badges?.[option.id]" class="country-suggestions__emblem" :src="badges[option.id]" alt="" />
              <span v-else-if="!names && countryInfoById.get(option.id)?.flagCode" class="country-suggestions__flag fi" :class="`fi-${countryInfoById.get(option.id)?.flagCode}`" aria-hidden="true" />
              <span class="country-suggestions__name">{{ option.name }}</span>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>

<style scoped>
.country-answer { min-width: 0; }
.country-answer__label { display: block; margin-bottom: 0.35rem; color: var(--ui-text); font-size: var(--ui-text-control); font-weight: var(--ui-weight); }
.country-answer__anchor {
  display: flex; align-items: center; gap: 0.65rem;
  border: 1px solid var(--ui-border-strong); border-radius: var(--ui-radius-control); padding: var(--ui-space-3);
  color: var(--ui-muted); background: var(--ui-surface);
}
.country-answer__anchor--correct { border-color: var(--ui-success-border); background: var(--ui-success-surface); color: var(--ui-success); }
.country-answer__anchor--wrong { border-color: var(--ui-error-border); background: var(--ui-error-surface); color: var(--ui-error); }
.country-answer__anchor:focus-within { border-color: var(--ui-focus); box-shadow: 0 0 0 3px var(--ui-focus-halo); }
.country-answer__input { width: 100%; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ui-ink); font: inherit; font-size: 1rem; font-weight: var(--ui-weight-large); }
.country-answer__input[readonly] { font-weight: var(--ui-weight-emphasis); }
.country-answer__input::placeholder { color: var(--ui-muted); }
</style>

<!-- The portaled content wrapper does not inherit this component’s scope ID. -->
<style>
.country-suggestions {
  z-index: 20; width: var(--reka-combobox-trigger-width);
  max-height: min(260px, var(--reka-combobox-content-available-height, 260px)); overflow: hidden;
  border: 1px solid var(--ui-border); border-radius: var(--ui-radius-control); padding: 0.3rem;
  background: var(--ui-surface); color: var(--ui-ink); box-shadow: var(--ui-shadow-panel);
}
.country-suggestions__viewport { min-height: 0; max-height: inherit; overflow-y: auto; overscroll-behavior: contain; }
.country-suggestions__item { display: flex; align-items: center; gap: var(--ui-space-2); min-height: var(--ui-control-height); line-height: 1.4; padding: 0.625rem var(--ui-space-3); border-radius: var(--ui-radius-small); font-size: var(--ui-text-body); font-weight: var(--ui-weight-large); cursor: pointer; outline: none; }
.country-suggestions__emblem { width: 1.5rem; height: 1.5rem; object-fit: contain; flex: 0 0 auto; }
.country-suggestions__flag { flex: 0 0 auto; width: 1.333333rem; font-size: 1rem; border-radius: 2px; }
.country-suggestions__name { min-width: 0; overflow-wrap: anywhere; }
.country-suggestions__item[data-highlighted] { background: var(--ui-hover); color: var(--ui-ink); }
.country-suggestions__empty { padding: 0.75rem; color: var(--ui-muted); font-size: var(--ui-text-body); font-weight: var(--ui-weight-large); }
</style>
