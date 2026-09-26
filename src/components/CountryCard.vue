<script setup lang="ts">
import { computed } from 'vue'
import type { CountryInfo, GeographicComponentInfo } from '../types/country'
import { componentName, componentType, countryName, t } from '../i18n'

const props = defineProps<{
  country: CountryInfo | null
  component: GeographicComponentInfo | null
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
  <aside class="country-card" aria-live="polite">
    <template v-if="country">
      <div class="country-card__flags">
        <span
          class="country-card__flag fi"
          :class="`fi-${country.flagCode}`"
          role="img"
          :aria-label="t('flag', { name: countryName(country.id) })"
        />
        <span
          v-if="componentDetail?.flagCode"
          class="country-card__flag country-card__flag--component fi"
          :class="`fi-${componentDetail.flagCode}`"
          role="img"
          :aria-label="t('flag', { name: componentDetail.name })"
        />
      </div>
      <div>
        <p class="country-card__label">{{ t('selectedCountry') }}</p>
        <h2>{{ countryName(country.id) }}</h2>
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
  display: flex;
  min-height: 128px;
  align-items: center;
  justify-content: flex-start;
  gap: 1.5rem;
  /* Keep the largest flag within the card's reserved 128px height. */
  padding: 0.75rem 1.25rem;
}

.country-card__flag {
  width: 1.333333em;
  flex: 0 0 auto;
  border-radius: 7px;
  box-shadow: 0 10px 28px rgba(23, 45, 56, 0.3);
  font-size: clamp(4rem, 8vw, 6.5rem);
}

.country-card__flags {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  gap: 0.45rem;
}

.country-card__flag--component {
  border-radius: 4px;
  box-shadow: 0 6px 16px rgba(23, 45, 56, 0.22);
  font-size: clamp(1.6rem, 3vw, 2.3rem);
}

.country-card__label,
.country-card__code,
.country-card__empty {
  margin: 0;
  color: #687678;
}

.country-card__label {
  margin-bottom: 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.country-card__code {
  margin-top: 0.25rem;
  font-size: 0.8rem;
}

.country-card__component {
  margin: 0.2rem 0 0;
  color: #52676e;
  font-size: 0.9rem;
}

h2 {
  margin: 0;
  color: #172d38;
  font-size: clamp(1.2rem, 2.5vw, 1.65rem);
}

.country-card__empty {
  text-align: left;
}

@media (max-width: 520px) {
  .country-card {
    gap: 0.8rem;
    padding-inline: 0.75rem;
  }

  .country-card__flag {
    font-size: clamp(3rem, 18vw, 4rem);
  }

  .country-card__flag--component {
    font-size: 1.7rem;
  }
}
</style>
