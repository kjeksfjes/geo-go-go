<script setup lang="ts">
import { computed, useId } from 'vue'
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { t } from '../i18n'
import '../styles/quiz-tips.css'

const props = defineProps<{ anchor: HTMLElement; description: string }>()
const emphasizedLabel = computed(() => props.description.includes(t('nextCountry')) ? t('nextCountry') : t('nextCountry').split(' ')[0]!)
const descriptionParts = computed(() => props.description.split(emphasizedLabel.value))
const emit = defineEmits<{ close: []; dismiss: []; disable: [] }>()
function handleOpenChange(open: boolean) { if (!open) emit('close') }
const titleId = `quiz-tip-${useId()}`
const side = computed(() => window.matchMedia('(max-width: 680px)').matches ? 'bottom' : 'right')
</script>

<template>
  <PopoverRoot :open="true" :modal="false" @update:open="handleOpenChange">
    <PopoverAnchor :reference="anchor" class="quiz-tip-anchor" />
    <PopoverPortal>
      <PopoverContent
        class="geo-quiz-tip"
        :side="side"
        align="start"
        :side-offset="12"
        :collision-padding="16"
        :aria-labelledby="titleId"
        :aria-label="t('tipTitle')"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
        @pointer-down-outside.prevent
        @focus-outside.prevent
        @interact-outside.prevent
      >
        <button class="geo-quiz-tip-close" type="button" :aria-label="t('tipClose')" @click="emit('close')">×</button>
        <h2 :id="titleId" class="geo-quiz-tip-title">{{ t('tipTitle') }}</h2>
        <p class="geo-quiz-tip-description"><template v-for="(part, index) in descriptionParts" :key="index"><strong v-if="index > 0">{{ emphasizedLabel }}</strong>{{ part }}</template></p>
        <div class="geo-quiz-tip-actions">
          <button class="geo-quiz-tip-disable" type="button" @click="emit('disable')">{{ t('tipNoMore') }}</button>
          <button class="geo-quiz-tip-done" type="button" @click="emit('dismiss')">{{ t('tipGotIt') }}</button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
