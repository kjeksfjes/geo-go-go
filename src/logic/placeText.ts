import { t, type MessageKey } from '../i18n'
import type { PlaceKind } from '../types/administrativeMap'

// Keep the existing country vocabulary as the common component API.
const vocabulary: Partial<Record<MessageKey, readonly [MessageKey, MessageKey]>> = {
  quiz: ['findCounty', 'findState'], findCountry: ['findCounty', 'findState'], nameCountry: ['nameCounty', 'nameState'],
  identifyQuestion: ['identifyCountyQuestion', 'identifyStateQuestion'],
  countryAnswerHint: ['countyAnswerHint', 'stateAnswerHint'], clickLocation: ['clickCountyLocation', 'clickStateLocation'],
  nextCountry: ['nextCounty', 'nextState'], noCountries: ['noCounties', 'noStates'],
  countryNamePlaceholder: ['countyNamePlaceholder', 'stateNamePlaceholder'],
  countrySuggestions: ['countySuggestions', 'stateSuggestions'], noCountryMatches: ['noCountyMatches', 'noStateMatches'],
  selectedCountry: ['selectedCounty', 'selectedState'], chooseCountry: ['chooseCounty', 'chooseState'],
  countryMarkers: ['countyMarkers', 'stateMarkers'], countryMarkersHint: ['countyMarkersHint', 'stateMarkersHint'],
  revealClickedCountry: ['revealClickedCounty', 'revealClickedState'], revealClickedCountryHint: ['revealClickedCountyHint', 'revealClickedStateHint'],
  limitAutomaticCountryZoom: ['limitAutomaticCountyZoom', 'limitAutomaticStateZoom'],
  selectedRegion: ['norwayCounties', 'usaStates'], allCountries: ['allCounties', 'allStates'],
  answerSuggestionsHint: ['countySuggestionsHint', 'stateSuggestionsHint'],
  worldMapGame: ['countyMap', 'stateMap'], flag: ['coatOfArms', 'flag'],
  tipTapNext: ['tipCountyTapNext', 'tipStateTapNext'], tipClickNext: ['tipCountyClickNext', 'tipStateClickNext'],
  tipSpaceNext: ['tipCountySpaceNext', 'tipStateSpaceNext'], tipAnswerKeys: ['tipCountyAnswerKeys', 'tipStateAnswerKeys'],
  tipAnswerGo: ['tipCountyAnswerGo', 'tipStateAnswerGo'], tipAutoRevealClicked: ['tipCountyAutoRevealClicked', 'tipStateAutoRevealClicked'],
}

export function placeText(kind: PlaceKind, key: MessageKey, values: Record<string, string | number> = {}) {
  const translated = kind === 'country' ? key : vocabulary[key]?.[kind === 'county' ? 0 : 1] ?? key
  return t(translated, values)
}
