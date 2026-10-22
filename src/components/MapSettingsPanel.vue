<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import MapDetailToggle from './MapDetailToggle.vue'
import ProjectionSelector from './ProjectionSelector.vue'
import { projectionOptions, type MapProjectionId } from '../composables/useMapProjection'
import { type ScaleUnitSystem } from '../logic/mapScale'
import { t, type Locale } from '../i18n'

defineProps<{
  open: boolean; county?: boolean; locale: Locale
  detailLoading: boolean; projectionLoading: boolean; highDetailEnabled: boolean
  bathymetryLoading: boolean; bathymetryEnabled: boolean; reliefLoading: boolean; reliefEnabled: boolean
  interactionLocked: boolean; quizMode: boolean; projectionId: MapProjectionId
  quizTipsEnabled: boolean; suggestAllCountries: boolean; automaticAnswerReveal: boolean; alwaysShowWrongAnswer: boolean
}>()
const autoRegionalProjection = defineModel<boolean>('autoRegionalProjection', { required: true })
const marineLabelsEnabled = defineModel<boolean>('marineLabelsEnabled', { required: true })
const countryMarkersEnabled = defineModel<boolean>('countryMarkersEnabled', { required: true })
const limitedCountryZoomEnabled = defineModel<boolean>('limitedCountryZoomEnabled', { required: true })
const scaleBarEnabled = defineModel<boolean>('scaleBarEnabled', { required: true })
const scaleUnits = defineModel<ScaleUnitSystem>('scaleUnits', { required: true })
const emit = defineEmits<{
  'locale-change': [locale: Locale]; 'detail-change': [enabled: boolean]
  'bathymetry-change': [enabled: boolean]; 'relief-change': [enabled: boolean]; 'projection-change': [projection: MapProjectionId]
  'quiz-tips-enabled-change': [enabled: boolean]; 'quiz-tips-reset': []
  'suggest-all-countries-change': [enabled: boolean]; 'automatic-answer-reveal-change': [enabled: boolean]; 'wrong-answer-preference-change': [enabled: boolean]
}>()
const requestDetailChange = (enabled: boolean) => emit('detail-change', enabled)
const setBathymetryEnabled = (enabled: boolean) => emit('bathymetry-change', enabled)
const setReliefEnabled = (enabled: boolean) => emit('relief-change', enabled)
const selectProjection = (id: MapProjectionId) => emit('projection-change', id)
const tipsResetConfirmed = ref(false)
let resetTimer: number | undefined
function resetQuizTips() {
  emit('quiz-tips-reset'); tipsResetConfirmed.value = true
  if (resetTimer !== undefined) window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => { tipsResetConfirmed.value = false }, 3000)
}
onBeforeUnmount(() => { if (resetTimer !== undefined) window.clearTimeout(resetTimer) })
</script>

<template>
      <div v-show="open" id="map-settings-panel" class="map-settings-panel" role="region" :aria-label="t('mapSettings')">
        <div class="map-settings-language">
          <span>{{ t('language') }}</span>
          <div class="language-selector" role="group" :aria-label="t('language')">
            <button type="button" :aria-pressed="locale === 'en'" lang="en" @click="emit('locale-change', 'en')">EN</button>
            <button type="button" :aria-pressed="locale === 'nb'" lang="nb" @click="emit('locale-change', 'nb')">NO</button>
          </div>
        </div>
        <section class="settings-section" aria-labelledby="settings-appearance-heading">
          <h3 id="settings-appearance-heading">{{ t('mapAppearance') }}</h3>
          <div class="settings-layer-options" role="group" aria-labelledby="settings-appearance-heading" aria-describedby="settings-layer-performance-hint">
            <MapDetailToggle
              :loading="detailLoading"
              :disabled="projectionLoading"
              :model-value="highDetailEnabled"
              @update:model-value="requestDetailChange"
            />
            <MapDetailToggle :label="t('bathymetry')" :loading="bathymetryLoading" :disabled="interactionLocked" :model-value="bathymetryEnabled" @update:model-value="setBathymetryEnabled" />
            <MapDetailToggle :label="t('relief')" :loading="reliefLoading" :disabled="interactionLocked" :model-value="reliefEnabled" @update:model-value="setReliefEnabled" />
            <MapDetailToggle
              :label="t('waterNames')"
              :description="!county && quizMode ? t('waterNamesQuizHint') : undefined"
              :disabled="interactionLocked || quizMode || county"
              :model-value="marineLabelsEnabled && !quizMode && !county"
              @update:model-value="marineLabelsEnabled = $event"
            />
            <p id="settings-layer-performance-hint" class="settings-hint">{{ t('mapPerformanceHint') }}</p>
          </div>
          <MapDetailToggle
            :label="t('autoRegionalProjection')"
            :description="t('autoRegionalProjectionHint')"
            :model-value="autoRegionalProjection"
            :disabled="interactionLocked"
            @update:model-value="autoRegionalProjection = $event"
          />
          <div class="projection-control">
            <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">
              <path d="m2 5 6-2 8 2 6-2v16l-6 2-8-2-6 2V5Zm6-2v16m8-14v16" />
            </svg>
            <ProjectionSelector :model-value="projectionId" :disabled="interactionLocked" :options="projectionOptions" @update:model-value="selectProjection" />
          </div>
        </section>
        <div class="settings-side-column">
          <section class="settings-section" aria-labelledby="settings-quiz-heading">
            <h3 id="settings-quiz-heading">{{ t('quizSettings') }}</h3>
            <div class="quiz-tips-setting">
              <MapDetailToggle
                :label="t('quizTips')"
                :model-value="quizTipsEnabled"
                @update:model-value="emit('quiz-tips-enabled-change', $event)"
              />
              <p class="settings-hint">
                {{ t('quizTipsHint') }}
                <button class="quiz-tips-reset" type="button" :title="t('tipResetHint')" @click="resetQuizTips">{{ t('tipReset') }}</button>
                <span class="quiz-tips-reset-status" role="status">{{ tipsResetConfirmed ? `✓ ${t('tipResetDone')}` : '' }}</span>
              </p>
            </div>
            <MapDetailToggle
              :label="t(county ? 'countyMarkers' : 'countryMarkers')"
              :description="t(county ? 'countyMarkersHint' : 'countryMarkersHint')"
              :model-value="countryMarkersEnabled"
              @update:model-value="countryMarkersEnabled = $event"
            />
            <fieldset :disabled="county" class="answer-scope-setting" aria-describedby="answer-scope-context answer-scope-hint">
              <legend class="visually-hidden">{{ t('answerSuggestions') }}</legend>
              <p class="settings-card-title" aria-hidden="true">{{ t('answerSuggestions') }}</p>
              <p id="answer-scope-context" class="settings-context">{{ t('appliesToMode', { mode: t(county ? 'nameCounty' : 'nameCountry') }) }}</p>
              <div class="answer-scope-choices">
                <label>
                  <input type="radio" name="quiz-answer-scope" :checked="!suggestAllCountries" @change="emit('suggest-all-countries-change', false)" />
                  <span>{{ t(county ? 'norwayCounties' : 'selectedRegion') }}</span>
                </label>
                <label>
                  <input type="radio" name="quiz-answer-scope" :checked="suggestAllCountries" @change="emit('suggest-all-countries-change', true)" />
                  <span>{{ t(county ? 'allCounties' : 'allCountries') }}</span>
                </label>
              </div>
              <p id="answer-scope-hint" class="settings-hint">{{ t(county ? 'countySuggestionsHint' : 'answerSuggestionsHint') }}</p>
            </fieldset>
            <MapDetailToggle
              :label="t('revealAnswersAutomatically')"
              :context="t('appliesToMode', { mode: t(county ? 'nameCounty' : 'nameCountry') })"
              :description="t('revealAnswersAutomaticallyHint')"
              :model-value="automaticAnswerReveal"
              @update:model-value="emit('automatic-answer-reveal-change', $event)"
            />
            <MapDetailToggle
              :label="t(county ? 'revealClickedCounty' : 'revealClickedCountry')"
              :context="t('appliesToMode', { mode: t(county ? 'findCounty' : 'findCountry') })"
              :description="t(county ? 'revealClickedCountyHint' : 'revealClickedCountryHint')"
              :model-value="alwaysShowWrongAnswer"
              @update:model-value="emit('wrong-answer-preference-change', $event)"
            />
          </section>
          <section class="settings-section" aria-labelledby="settings-navigation-heading">
            <h3 id="settings-navigation-heading">{{ t('navigationAndScale') }}</h3>
            <MapDetailToggle
              :label="t(county ? 'limitAutomaticCountyZoom' : 'limitAutomaticCountryZoom')"
              :description="t('limitCountryZoomHint')"
              :model-value="limitedCountryZoomEnabled"
              @update:model-value="limitedCountryZoomEnabled = $event"
            />
            <MapDetailToggle :label="t('showScaleBar')" :model-value="scaleBarEnabled" @update:model-value="scaleBarEnabled = $event" />
            <label class="scale-units-control" for="map-scale-units">
              <span>{{ t('scaleUnits') }}</span>
              <select id="map-scale-units" v-model="scaleUnits">
                <option value="metric">{{ t('metricUnits') }}</option>
                <option value="imperial">{{ t('imperialUnits') }}</option>
                <option value="nautical">{{ t('nauticalUnits') }}</option>
              </select>
            </label>
          </section>
        </div>
      </div>

</template>

<style scoped>
.projection-control {
  --map-select-arrow-right: 0.8rem;
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-control);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-control);
}

.projection-control :deep(.map-select-field) {
  min-width: 0;
  flex: 1;
}

.projection-control :deep(.map-select-field .vue3-treeselect) {
  width: 100%;
  min-width: 0;
}

.projection-control :deep(.vue3-treeselect__single-value) { padding-right: 1.75rem; }

.control-icon {
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
  margin-left: 0.65rem;
  color: var(--ui-ink);
}

.settings-section, .settings-layer-options { display: grid; align-content: start; gap: var(--ui-space-2); }
.settings-layer-options {
  min-width: 0;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-paper);
}
.settings-layer-options > .settings-hint { margin-top: var(--ui-space-1); }
.settings-side-column { display: grid; align-content: start; gap: 0.35rem; }
.settings-side-column > .settings-section:first-child { border-top: 1px solid var(--ui-border); padding-top: 0.8rem; margin-top: 0.45rem; }
.settings-section + .settings-section { border-top: 1px solid var(--ui-border); padding-top: 1rem; margin-top: 0.7rem; }
.settings-section h3 { margin: 0 0 var(--ui-space-1); padding: 0 0.2rem; color: var(--ui-muted); font-size: var(--ui-text-small); letter-spacing: 0.1em; text-transform: uppercase; }
.settings-hint { margin: 0.35rem 0.2rem 0; color: var(--ui-muted); font-size: var(--ui-text-small); line-height: 1.4; }
.answer-scope-setting { min-width: 0; margin: 0; padding: var(--ui-space-3); border: 1px solid var(--ui-border); border-radius: var(--ui-radius-control); background: var(--ui-surface); box-shadow: var(--ui-shadow-control); }
.settings-card-title { margin: 0; color: var(--ui-text); font-size: var(--ui-text-control); font-weight: var(--ui-weight); }
.settings-context { margin: 0.4rem 0 0.5rem; color: var(--ui-muted); font-size: var(--ui-text-small); font-weight: var(--ui-weight); }
.answer-scope-choices { display: flex; gap: 0.2rem; padding: 0.2rem; border: 1px solid var(--ui-border-strong); border-radius: var(--ui-radius-control); background: var(--ui-surface); }
.answer-scope-choices label { position: relative; flex: 1; text-align: center; cursor: pointer; }
.answer-scope-choices input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.answer-scope-choices span { display: block; padding: 0.55rem 0.25rem; border-radius: var(--ui-radius-small); color: var(--ui-text); font-size: var(--ui-text-control); font-weight: var(--ui-weight); }
.answer-scope-choices input:checked + span { background: var(--ui-ink); color: #fff; }
.answer-scope-choices input:focus-visible + span { outline: 2px solid var(--ui-focus); outline-offset: 2px; }

.quiz-tips-setting {
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-control);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-control);
}
.quiz-tips-setting :deep(.detail-toggle) {
  border: 0;
  background: transparent;
  box-shadow: none;
}
.quiz-tips-setting .settings-hint {
  margin: 0;
  padding: 0 var(--ui-space-3) var(--ui-space-2);
}

.quiz-tips-reset {
  padding: 0;
  border: 0;
  border-radius: 2px;
  color: var(--ui-text);
  background: transparent;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.15em;
  cursor: pointer;
}
.quiz-tips-reset:hover { color: var(--ui-ink); }
.quiz-tips-reset:focus-visible { outline: 2px solid var(--ui-focus); outline-offset: 2px; }
.quiz-tips-reset-status { margin-inline-start: 0.35rem; color: var(--ui-success); }

.map-settings-panel {
  position: absolute;
  z-index: 4;
  top: 0.85rem;
  right: 1.25rem;
  display: grid;
  width: min(18rem, calc(100% - 1.5rem));
  gap: 0.35rem;
  max-height: min(calc(100% - 1.7rem), calc(100dvh - 5.5rem));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-panel);
  box-shadow: var(--ui-shadow-panel);
  backdrop-filter: blur(12px);
}


.map-settings-panel :deep(.detail-toggle) {
  width: 100%;
  min-height: var(--ui-control-height);
  justify-content: space-between;
  border-radius: var(--ui-radius-control);
}

.map-settings-language { display: none; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.2rem; color: var(--ui-text); font-size: var(--ui-text-control); font-weight: var(--ui-weight); }

.scale-units-control {
  position: relative;
  display: flex;
  min-height: var(--ui-control-height);
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-control);
  color: var(--ui-text);
  background: var(--ui-surface);
  font-size: var(--ui-text-control);
  font-weight: var(--ui-weight);
  box-shadow: var(--ui-shadow-control);
}

.scale-units-control::after {
  position: absolute; right: 1.1rem; top: 50%;
  width: 0.4rem; height: 0.4rem;
  border-right: 1.5px solid var(--ui-ink); border-bottom: 1.5px solid var(--ui-ink);
  transform: translateY(-0.3rem) rotate(45deg);
  pointer-events: none; content: "";
}

.scale-units-control select {
  appearance: none;
  min-height: 2rem;
  min-width: 0;
  max-width: 9rem;
  padding: var(--ui-space-1) 1.75rem var(--ui-space-1) var(--ui-space-2);
  border: 1px solid var(--ui-border-strong);
  border-radius: var(--ui-radius-small);
  color: var(--ui-ink);
  background: var(--ui-surface);
  font: inherit;
}


@media (max-width: 850px) { .map-settings-panel { top: 0.75rem; right: 0.75rem; } }
@media (min-width: 900px) {
  .map-settings-panel { width: min(36rem, calc(100% - 2.5rem)); grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; }
  .settings-side-column > .settings-section:first-child { border-top: 0; padding-top: 0; margin-top: 0; }
}
@media (max-width: 680px) {
  .map-settings-language { display: flex; padding-bottom: 0.6rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--ui-border); }
  .map-settings-panel { max-height: min(calc(100% - 1.5rem), calc(100dvh - 7.25rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))); }
  .map-settings-language :deep(.language-selector) { padding: 0.15rem; }
  .map-settings-language :deep(.language-selector button) { min-height: 2.05rem; padding: 0.25rem 0.6rem; }
}
</style>
