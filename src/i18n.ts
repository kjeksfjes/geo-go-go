import { ref } from 'vue'
import { countryInfoById } from './data/countries'
import type { GeographicComponentInfo } from './types/country'
import type { MapRegion } from './data/regions'

export type Locale = 'en' | 'nb'

const storageKey = 'geo-go-go.locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'en' || saved === 'nb') return saved
  } catch { /* Private browsing may deny storage. */ }

  const browserLanguage = typeof navigator === 'undefined'
    ? ''
    : navigator.languages?.[0] ?? navigator.language
  return /^(nb|nn|no)(-|$)/i.test(browserLanguage) ? 'nb' : 'en'
}

export const locale = ref<Locale>(initialLocale())

export function setLocale(next: Locale) {
  locale.value = next
  document.documentElement.lang = next
  try { localStorage.setItem(storageKey, next) } catch { /* Language still changes. */ }
}

export function applyDocumentLocale() {
  document.documentElement.lang = locale.value
}

const messages = {
  en: {
    language: 'Language', eyebrow: 'A tiny geography game', title: 'Where in the world?',
    subtitle: 'Explore the map and pick a country.', gameMode: 'Game mode',
    explore: 'Explore', findCountry: 'Find the country', worldMapGame: 'World map game',
    region: 'Region', projection: 'Projection', regionalEqualArea: 'Regional Equal Area', mapSettings: 'Map settings', mapControls: 'Map controls', highDetail: 'High detail', bathymetry: 'Bathymetry', relief: 'Relief', waterNames: 'Water names', adaptiveCountryZoom: 'Adaptive country zoom',
    interactiveMap: 'Interactive world map', resetView: 'Reset view',
    mapHint: 'Scroll to zoom · Drag to move', continueHint: 'Click map or press Space to continue',
    loadingMap: 'Loading detailed map…', selectedCountry: 'Selected country',
    mapCode: 'Map code · {code}', chooseCountry: 'Choose a country on the map',
    flag: '{name} flag', quiz: 'Find the country quiz', regionComplete: 'Region complete',
    finalScore: 'Final score: {score} / {total}', playAgain: 'Play again',
    noCountries: 'No quiz countries in this region',
    questionStatus: 'Question {number}/{total} · {score} pts',
    find: 'Find {name}', clickLocation: 'Click its location on the map. Dots mark tiny countries.',
    selectSmallCountry: 'Select {name}', zoomToSmallCountries: 'Zoom in on {count} small countries',
    correctSmallCountry: 'Correct country: {name}', wrongSmallCountry: 'Your answer: {name}',
    wrongAnswerMarker: 'Your selected country',
    correct: 'Correct! +1 point.', wrong: 'Not quite. Green marks the answer.',
    youClickedBefore: 'You clicked ', youClickedAfter: '.', whatDidIClick: 'What did I click?', alwaysShowAnswer: 'Always show',
    showOnMap: 'Show on map', showCountryOnMap: 'Show {name} on the map',
    seeResults: 'See results', nextCountry: 'Next country',
  },
  nb: {
    language: 'Språk', eyebrow: 'Et lite geografispill', title: 'Hvor i verden?',
    subtitle: 'Utforsk kartet og velg et land.', gameMode: 'Spillmodus',
    explore: 'Utforsk', findCountry: 'Finn landet', worldMapGame: 'Verdenskartspill',
    region: 'Region', projection: 'Projeksjon', regionalEqualArea: 'Regional arealriktig', mapSettings: 'Kartinnstillinger', mapControls: 'Kartvalg', highDetail: 'Høy detaljgrad', bathymetry: 'Havdybde', relief: 'Terreng', waterNames: 'Havnavn', adaptiveCountryZoom: 'Tilpasset landzoom',
    interactiveMap: 'Interaktivt verdenskart', resetView: 'Tilbakestill visning',
    mapHint: 'Rull for å zoome · Dra for å flytte', continueHint: 'Klikk på kartet eller trykk mellomrom for å fortsette',
    loadingMap: 'Laster detaljert kart…', selectedCountry: 'Valgt land',
    mapCode: 'Kartkode · {code}', chooseCountry: 'Velg et land på kartet',
    flag: 'Flagget til {name}', quiz: 'Finn landet', regionComplete: 'Regionen er fullført',
    finalScore: 'Sluttresultat: {score} / {total}', playAgain: 'Spill igjen',
    noCountries: 'Ingen quizland i denne regionen',
    questionStatus: 'Spørsmål {number}/{total} · {score} poeng',
    find: 'Finn {name}', clickLocation: 'Klikk på landet i kartet. Prikker viser små land.',
    selectSmallCountry: 'Velg {name}', zoomToSmallCountries: 'Zoom inn på {count} små land',
    correctSmallCountry: 'Riktig land: {name}', wrongSmallCountry: 'Ditt svar: {name}',
    wrongAnswerMarker: 'Landet du valgte',
    correct: 'Riktig! +1 poeng.', wrong: 'Ikke helt. Riktig land er markert i grønt.',
    youClickedBefore: 'Du klikket på ', youClickedAfter: '.', whatDidIClick: 'Hva klikket jeg på?', alwaysShowAnswer: 'Vis alltid',
    showOnMap: 'Vis i kartet', showCountryOnMap: 'Vis {name} i kartet',
    seeResults: 'Se resultat', nextCountry: 'Neste land',
  },
} satisfies Record<Locale, Record<string, string>>

export type MessageKey = keyof typeof messages.en

export function t(key: MessageKey, values: Record<string, string | number> = {}) {
  return messages[locale.value][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

const norwegianRegions: Record<MapRegion['id'], string> = {
  world: 'Verden', europe: 'Europa', nordics: 'Norden', baltics: 'Baltikum',
  balkans: 'Balkan', africa: 'Afrika', asia: 'Asia', 'middle-east': 'Midtøsten',
  'central-asia': 'Sentral-Asia', 'south-asia': 'Sør-Asia', 'east-asia': 'Øst-Asia',
  'southeast-asia': 'Sørøst-Asia', 'north-america': 'Nord-Amerika',
  'central-america-caribbean': 'Mellom-Amerika og Karibia',
  'south-america': 'Sør-Amerika', oceania: 'Oseania',
}

export function regionName(region: MapRegion) {
  return locale.value === 'nb' ? norwegianRegions[region.id] : region.label
}

const norwegianCountryOverrides: Record<string, string> = {
  Palestine: 'Palestina',
  'Democratic Republic of the Congo': 'Den demokratiske republikken Kongo',
  'Northern Cyprus': 'Nord-Kypros',
  Somaliland: 'Somaliland',
  'Australian Indian Ocean Territories': 'Australske territorier i Indiahavet',
  'Ashmore and Cartier Islands': 'Ashmore- og Cartierøyene',
  'Siachen Glacier': 'Siachenbreen',
}

function makeNorwegianDisplayNames() {
  try {
    return typeof Intl.DisplayNames === 'undefined'
      ? null
      : new Intl.DisplayNames(['nb'], { type: 'region', fallback: 'none' })
  } catch {
    return null
  }
}

const norwegianCountryNames = makeNorwegianDisplayNames()
const norwegianNameCache = new Map<string, string>()

function localizedRegionCode(code: string) {
  try {
    return norwegianCountryNames?.of(code.toUpperCase())
  } catch {
    // Some atlas entries have non-ISO flag codes. DisplayNames can throw
    // instead of returning undefined for these, depending on the browser.
    return undefined
  }
}

export function countryName(id: string) {
  const country = countryInfoById.get(id)
  if (!country) return id
  if (locale.value === 'en') return country.name
  const cached = norwegianNameCache.get(id)
  if (cached) return cached
  const name = norwegianCountryOverrides[country.name]
    ?? localizedRegionCode(country.flagCode)
    ?? country.name
  norwegianNameCache.set(id, name)
  return name
}

const sourceComponentTypes: Record<string, Record<Locale, string>> = {
  Dependency: { en: 'Dependency', nb: 'Avhengig territorium' },
  'Special Municipality': { en: 'Special municipality', nb: 'Særskilt kommune' },
}

export function componentName(component: GeographicComponentInfo) {
  return component.nameOverrides?.[locale.value] ?? component.name
}

export function componentType(component: GeographicComponentInfo) {
  return component.typeOverrides?.[locale.value]
    ?? sourceComponentTypes[component.sourceType]?.[locale.value]
    ?? null
}
