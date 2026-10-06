<script setup lang="ts">
import { computed } from 'vue'
import type { CountryInfo, GeographicComponentInfo } from '../types/country'
import { componentName, componentType, countryName, t } from '../i18n'

const props = defineProps<{
  country: CountryInfo | null
  component: GeographicComponentInfo | null
  area?: { name: string; type: string } | null
}>()

const componentDetail = computed(() => {
  const { component, country } = props
  if (!component || !country || component.entityId !== country.id) return null
  const name = componentName(component)
  const type = componentType(component)
  if (!type && (component.name === country.name || name === countryName(country.id))) return null
  return { name, type, flagCode: component.flagCode }
})
</script>

<template>
  <aside class="country-card map-overlay__content" aria-live="polite">
    <template v-if="area">
      <div class="country-card__message">
        <p class="map-overlay__eyebrow">{{ t('selectedArea') }}</p>
        <h2 class="map-overlay__heading">{{ area.name }}</h2>
        <p class="country-card__component"><em>{{ area.type }}</em></p>
      </div>
    </template>
    <template v-else-if="country">
      <div class="country-card__flags">
        <span
          class="country-card__flag map-overlay__flag fi"
          :class="`fi-${country.flagCode}`"
          role="img"
          :aria-label="t('flag', { name: countryName(country.id) })"
        />
        <span
          v-if="componentDetail?.flagCode"
          class="country-card__flag map-overlay__flag country-card__flag--component fi"
          :class="`fi-${componentDetail.flagCode}`"
          role="img"
          :aria-label="t('flag', { name: componentDetail.name })"
        />
      </div>
      <div class="country-card__message">
        <p class="map-overlay__eyebrow">{{ t('selectedCountry') }}</p>
        <h2 class="map-overlay__heading">{{ countryName(country.id) }}</h2>
      </div>
      <div class="country-card__details">
        <p v-if="componentDetail" class="country-card__component">
          {{ componentDetail.name }}<span v-if="componentDetail.type"> · <em>{{ componentDetail.type }}</em></span>
        </p>
        <p class="country-card__code">{{ t('mapCode', { code: country.id }) }}</p>
      </div>
    </template>
    <p v-else class="country-card__empty">{{ t('chooseCountry') }}</p>
  </aside>
</template>

<style scoped>
.country-card {
  display: grid;
  grid-template-columns: var(--ui-card-flag-width) minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-card-row-gap) var(--ui-card-column-gap);
}

.country-card__message { min-width: 0; }
.country-card__message:first-child,
.country-card__empty { grid-column: 1 / -1; }
.country-card__details { grid-column: 2; min-width: 0; }

.country-card__flags {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-2);
}

.country-card__flag { flex: 0 0 auto; }
.country-card__flag--component { width: 1.666667rem; font-size: 1.25rem; }

.country-card__code,
.country-card__component,
.country-card__empty {
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-text-control);
  font-weight: var(--ui-weight);
  line-height: 1.4;
}

.country-card__component + .country-card__code { margin-top: var(--ui-space-1); }

@media (max-width: 560px) {
  .country-card__details { grid-column: 1 / -1; }
  .country-card__code { display: none; }
  .country-card__component { font-size: var(--ui-text-small); }
}
</style>
