<script setup lang="ts">
import type { CountryInfo } from '../types/country'

defineProps<{
  country: CountryInfo | null
}>()
</script>

<template>
  <aside class="country-card" aria-live="polite">
    <template v-if="country">
      <span
        class="country-card__flag fi"
        :class="`fi-${country.flagCode}`"
        role="img"
        :aria-label="`${country.name} flag`"
      />
      <div>
        <p class="country-card__label">Selected country</p>
        <h2>{{ country.name }}</h2>
        <p class="country-card__code">Map code · {{ country.id }}</p>
      </div>
    </template>
    <p v-else class="country-card__empty">Choose a country on the map</p>
  </aside>
</template>

<style scoped>
.country-card {
  display: flex;
  min-height: 128px;
  align-items: center;
  justify-content: center;
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

h2 {
  margin: 0;
  color: #172d38;
  font-size: clamp(1.2rem, 2.5vw, 1.65rem);
}

.country-card__empty {
  text-align: center;
}

@media (max-width: 520px) {
  .country-card {
    gap: 0.8rem;
    padding-inline: 0.75rem;
  }

  .country-card__flag {
    font-size: clamp(3rem, 18vw, 4rem);
  }
}
</style>
