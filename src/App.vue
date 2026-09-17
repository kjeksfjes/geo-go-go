<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import CountryCard from './components/CountryCard.vue'
import WorldMap from './components/WorldMap.vue'
import { countries, countryInfoById, loadDetailedCountries } from './data/countries'

const selectedCountryId = ref<string | null>(null)
const mapCountries = shallowRef(countries)
const highDetailEnabled = ref(false)
const detailLoading = ref(false)
let detailedCountries: typeof countries | undefined
const selectedCountry = computed(() =>
  selectedCountryId.value
    ? countryInfoById.get(selectedCountryId.value) ?? null
    : null,
)

async function setHighDetail(enabled: boolean) {
  if (!enabled) {
    mapCountries.value = countries
    highDetailEnabled.value = false
    return
  }

  if (detailedCountries) {
    mapCountries.value = detailedCountries
    highDetailEnabled.value = true
    return
  }

  detailLoading.value = true
  try {
    detailedCountries = await loadDetailedCountries()
    mapCountries.value = detailedCountries
    highDetailEnabled.value = true
  } catch (error) {
    console.error('Could not load the high-detail map.', error)
  } finally {
    detailLoading.value = false
  }
}
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <p class="eyebrow">A tiny geography game</p>
      <h1>Where in the world?</h1>
      <p>Explore the map and pick a country.</p>
    </header>

    <section class="map-card" aria-label="World map game">
      <WorldMap
        :countries="mapCountries"
        :detail-loading="detailLoading"
        :high-detail-enabled="highDetailEnabled"
        :selected-country-id="selectedCountryId"
        @detail-change="setHighDetail"
        @select="selectedCountryId = $event"
      />
    </section>

    <CountryCard :country="selectedCountry" />
  </main>
</template>
