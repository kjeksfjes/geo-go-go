<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import CountryCard from './components/CountryCard.vue'
import WorldMap from './components/WorldMap.vue'
import { countries, countryInfoById, loadDetailedCountries } from './data/countries'
import {
  countryIdsByRegion,
  regionById,
  regions,
  type MapRegionId,
} from './data/regions'
import { afterPaint, wait } from './utils/paint'

const selectedCountryId = ref<string | null>(null)
const activeRegionId = ref<MapRegionId>('world')
const mapCountries = shallowRef(countries)
const highDetailEnabled = ref(false)
const detailLoading = ref(false)
const detailBlurred = ref(false)
const detailedCountries = shallowRef<typeof countries | null>(null)
const activeRegion = computed(() => regionById.get(activeRegionId.value) ?? regions[0])
const visibleCountryIds = computed(() =>
  countryIdsByRegion.get(activeRegionId.value) ?? countryIdsByRegion.get('world')!,
)
const selectedCountry = computed(() =>
  selectedCountryId.value
    ? countryInfoById.get(selectedCountryId.value) ?? null
    : null,
)

function setActiveRegion(regionId: MapRegionId) {
  activeRegionId.value = regionId

  if (
    selectedCountryId.value
    && !visibleCountryIds.value.has(selectedCountryId.value)
  ) {
    selectedCountryId.value = null
  }
}

async function setHighDetail(enabled: boolean, pathsCached: boolean) {
  if (detailLoading.value) return

  if (!enabled) {
    mapCountries.value = countries
    highDetailEnabled.value = false
    return
  }

  if (detailedCountries.value && pathsCached) {
    mapCountries.value = detailedCountries.value
    highDetailEnabled.value = true
    return
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  highDetailEnabled.value = true
  detailLoading.value = true
  detailBlurred.value = true
  try {
    // Paint the blurred current map before loading or projecting detailed paths.
    await nextTick()
    await afterPaint()
    const minimumBlur = reducedMotion ? Promise.resolve() : wait(300)
    const [detailed] = await Promise.all([
      detailedCountries.value ?? loadDetailedCountries(),
      minimumBlur,
    ])
    detailedCountries.value = detailed
    mapCountries.value = detailed
    // Let the detailed paths render while they are still blurred.
    await nextTick()
    await afterPaint()
  } catch (error) {
    mapCountries.value = countries
    highDetailEnabled.value = false
    console.error('Could not load the high-detail map.', error)
  } finally {
    detailBlurred.value = false
    if (!reducedMotion) {
      await nextTick()
      await afterPaint()
      await wait(280)
    }
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
        :detailed-countries="detailedCountries"
        :detail-loading="detailLoading"
        :detail-blurred="detailBlurred"
        :high-detail-enabled="highDetailEnabled"
        :active-region="activeRegion"
        :region-options="regions"
        :selected-country-id="selectedCountryId"
        :visible-country-ids="visibleCountryIds"
        @detail-change="setHighDetail"
        @region-change="setActiveRegion"
        @select="selectedCountryId = $event"
      />
    </section>

    <CountryCard :country="selectedCountry" />
  </main>
</template>
