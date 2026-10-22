import geometry from './us-states.json'
import catalog from './us-state-catalog.json'
import type { AdministrativeMapData, AdministrativeFeature } from '../types/administrativeMap'

const flags = import.meta.glob('../assets/state-flags/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const usStateMap: AdministrativeMapData = {
  id: 'usa-states', kind: 'state', layout: 'us-insets', features: geometry.features as AdministrativeFeature[],
  places: new Map(catalog.map(state => [state.id, { id: state.id, name: state.name.en }])),
  ids: new Set(catalog.map(state => state.id)),
  names: {
    en: Object.fromEntries(catalog.map(state => [state.id, state.name.en])),
    nb: Object.fromEntries(catalog.map(state => [state.id, state.name.nb])),
  },
  badges: Object.fromEntries(catalog.map(state => [state.id, flags[`../assets/state-flags/${state.code}.svg`]!])),
  aliases: Object.fromEntries(catalog.map(state => [state.id, [state.name.en, state.name.nb, state.code]])),
  zoomReferenceIds: ['us:state:TX', 'us:state:CA'],
  attribution: { label: 'stateAttribution', url: 'https://www.census.gov/geographies/mapping-files/2025/geo/carto-boundary-file.html' },
  badgeSourcesUrl: new URL('../assets/state-flags/sources.json', import.meta.url).href,
}
