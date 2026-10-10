import { ref } from 'vue'
import { countryInfoById } from './data/countries'
import displayNames from './data/country-names.json'
import type { GeographicComponentInfo } from './types/country'
import type { MapRegion } from './data/regions'

export type Locale = 'en' | 'nb'

const storageKey = 'geo-go-go.locale'

function browserLocale(): Locale {
  const browserLanguage = typeof navigator === 'undefined'
    ? ''
    : navigator.languages?.[0] ?? navigator.language
  return /^(nb|nn|no)(-|$)/i.test(browserLanguage) ? 'nb' : 'en'
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'en' || saved === 'nb') return saved
  } catch { /* Private browsing may deny storage. */ }

  return browserLocale()
}

export const locale = ref<Locale>(initialLocale())

export function setLocale(next: Locale) {
  locale.value = next
  document.documentElement.lang = next
  try { localStorage.setItem(storageKey, next) } catch { /* Language still changes. */ }
}

export function resetLocale() {
  setLocale(browserLocale())
}

export function applyDocumentLocale() {
  document.documentElement.lang = locale.value
}

const messages = {
  en: {
    help: 'Help', helpInvitation: 'Take a quick tour.',
    helpReturn: 'You can reopen the guide anytime from Help.',
    helpStart: 'Start tour', helpDismiss: 'Dismiss', helpNext: 'Next', helpPrevious: 'Back', helpDone: 'Done', helpClose: 'Close guide',
    helpProgress: '{current} of {total}', helpLoadError: 'The guide could not load. Try Help again.',
    helpRegionTitle: 'Choose your region',
    helpRegionDescription: 'Choose which part of the world to explore. This can also be used to limit the countries used in the quizzes.<p><em>You can close this guide anytime and reopen it from Help.</em></p>',
    helpModeTitle: 'Explore or practise',
    helpModeDescription: 'You can either explore freely to learn the names of countries, or try one of the practice modes:<ul><li><strong>Find the country</strong>: locate the named country on the map.</li><li><strong>Name the country</strong>: identify the highlighted country by typing its name and choosing a suggestion.</li></ul><p><em>Note: Both quizzes use your selected region.</em></p>',
    helpMapTitle: 'Move around the map',
    helpMapDesktop: 'Scroll to zoom and drag to move around. After zooming, Reset view returns to the selected region. You can try after the guide is closed.',
    helpMapTouch: 'Pinch with two fingers to zoom and drag with one finger to move around. After zooming, Reset view returns to the selected region. You can try after the guide is closed.',
    helpSettingsTitle: 'Customise',
    helpSettingsDescription: 'Open <strong>Settings</strong> for map appearance and quiz preferences. On small screens, language is here too.',
    language: 'Language', eyebrow: 'A tiny geography game', title: 'Where in the world?',
    subtitle: 'Explore the map and pick a country.', gameMode: 'Game mode',
    explore: 'Explore', findCountry: 'Find the country', nameCountry: 'Name the country',
    identifyQuestion: 'Which country is highlighted?', yourGuess: 'Your guess', countryNamePlaceholder: 'Type a country name…',
    countrySuggestions: 'Country suggestions', noCountryMatches: 'No matching countries',
    countryAnswerHint: 'Type to search · ↑ ↓ to choose · Enter to answer', notQuite: 'Not quite.', correctAnswer: 'Correct answer:', highlightedCountry: 'Highlighted country', worldMapGame: 'World map game',
    region: 'Region', projection: 'Projection', regionalEqualArea: 'Regional Equal Area', mapSettings: 'Map settings', mapControls: 'Map controls', highDetail: 'High detail', bathymetry: 'Bathymetry', relief: 'Relief', waterNames: 'Water names', limitAutomaticCountryZoom: 'Limit country zoom', limitCountryZoomHint: 'Keep more surroundings visible when automatically framing a country. Manual zoom is unchanged.',
    showScaleBar: 'Show scale bar', scaleUnits: 'Scale units', metricUnits: 'Metric', imperialUnits: 'Imperial', nauticalUnits: 'Nautical', scaleAtMapCenter: 'Approximate scale near map center: {distance}',
    autoRegionalProjection: 'Proportional regions',
    autoRegionalProjectionHint: 'When you choose a region, switch to Regional Equal Area to preserve relative country areas. World view will still use the selected global projection.',
    mapPerformanceHint: 'These options may reduce performance on mobile or less powerful devices.',
    interactiveMap: 'Interactive world map', resetView: 'Reset view',
    fastZoomPreview: 'Fast zoom preview', touchPanPreview: 'Pan preview', normalZoom: 'Normal zoom', restoringZoomDetail: 'Restoring detail', svgZoom: 'SVG renderer',
    copyLastGesture: 'Copy last map movement report', noGestureReport: 'Pan, zoom or frame a country first to record a report', gestureCopied: 'Gesture report copied', gestureCopyFailed: 'Copy failed — tap to retry',
    mapHint: 'Scroll to zoom · Drag to move', continueHint: 'Click map or press Space to continue',
    loadingMap: 'Loading detailed map…', selectedCountry: 'Selected country', selectedArea: 'Selected area',
    mapCode: 'Map code · {code}', chooseCountry: 'Choose a country on the map',
    flag: '{name} flag', quiz: 'Find the country quiz', regionComplete: 'Region complete',
    finalScore: 'Final score: {score} / {total}', playAgain: 'Play again',
    restartQuiz: 'Restart quiz',
    leaveQuizConfirmation: 'Leave this quiz? Your progress in this round will be lost.',
    restartQuizConfirmation: 'Restart this quiz? Your progress in this round will be lost.',
    changeQuizRegionConfirmation: 'Start a new quiz in {region}? Your progress in the current round will be lost.',
    noCountries: 'No quiz countries in this region',
    questionStatus: 'Question {number}/{total} · {score} {points}', point: 'pt', points: 'pts',
    find: 'Find {name}', clickLocation: 'Click the country on the map',
    countryMarkers: 'Country markers',
    countryMarkersHint: 'Show small-country dots in regional or zoomed views, and location cues for tiny quiz questions.',
    chooseSmallCountry: 'Choose this country',
    zoomHere: 'Zoom to see small countries',
    correctSmallCountry: 'Correct country: {name}', wrongSmallCountry: 'Your answer: {name}',
    wrongAnswerMarker: 'Your selected country',
    correct: 'Correct! +1 point.', wrong: 'Not quite. Green marks the answer.',
    youClickedBefore: 'You clicked ', youClickedAfter: '.', whatDidIClick: 'What did I click?',
    skipQuestion: 'Skip', skippedQuestion: 'Skipped. No point awarded.', showAnswer: 'Show answer', showAutomatically: 'Always show',
    alwaysRevealAnswers: 'Always show answers after wrong guesses or skipping',
    revealAnswersAutomatically: 'Reveal answers automatically', revealAnswersAutomaticallyHint: 'Show the correct country name after a wrong guess or when you skip a question.',
    myGuess: 'My guess', mapAppearance: 'Map appearance', quizSettings: 'Quiz', navigationAndScale: 'Navigation & scale',
    answerSuggestions: 'Answer suggestions', selectedRegion: 'Selected region', allCountries: 'All countries',
    appliesToMode: 'For {mode}', answerSuggestionsHint: 'Questions always come from the selected region.',
    revealClickedCountry: 'Reveal clicked country names', revealClickedCountryHint: 'Show which country you clicked after a wrong answer.',
    viewingOutsideGuess: 'Showing your guess outside the selected region.',
    showOnMap: 'Show on map', showCountryOnMap: 'Show {name} on the map',
    seeResults: 'See results', nextCountry: 'Next country',
  },
  nb: {
    help: 'Hjelp', helpInvitation: 'Ta en rask omvisning.',
    helpReturn: 'Du kan åpne guiden igjen når som helst fra Hjelp.',
    helpStart: 'Start omvisning', helpDismiss: 'Lukk', helpNext: 'Neste', helpPrevious: 'Tilbake', helpDone: 'Ferdig', helpClose: 'Lukk guiden',
    helpProgress: '{current} av {total}', helpLoadError: 'Guiden kunne ikke lastes. Prøv Hjelp igjen.',
    helpRegionTitle: 'Velg region',
    helpRegionDescription: 'Velg hvilken del av verden du vil utforske. Dette kan også brukes til å begrense hvilke land som brukes i quizene.<p><em>Du kan lukke guiden når som helst og åpne den igjen fra Hjelp.</em></p>',
    helpModeTitle: 'Utforsk eller øv',
    helpModeDescription: 'Du kan enten utforske fritt for å lære navnene på land, eller prøve en av øvingsmodusene:<ul><li><strong>Finn landet</strong>: finn det oppgitte landet på kartet.</li><li><strong>Navngi landet</strong>: skriv navnet på det markerte landet og velg et forslag.</li></ul><p><em>Merk: Begge quizene bruker regionen du har valgt.</em></p>',
    helpMapTitle: 'Naviger på kartet',
    helpMapDesktop: 'Rull for å zoome og dra for å flytte kartet. Etter zooming tar Tilbakestill visning deg tilbake til den valgte regionen. Du kan prøve etter at guiden er lukket.',
    helpMapTouch: 'Knip med to fingre for å zoome og dra med én finger for å flytte kartet. Etter zooming tar Tilbakestill visning deg tilbake til den valgte regionen. Du kan prøve etter at guiden er lukket.',
    helpSettingsTitle: 'Tilpass',
    helpSettingsDescription: 'Åpne <strong>Innstillinger</strong> for kartutseende og quizvalg. På små skjermer finner du også språk her.',
    language: 'Språk', eyebrow: 'Et lite geografispill', title: 'Hvor i verden?',
    subtitle: 'Utforsk kartet og velg et land.', gameMode: 'Spillmodus',
    explore: 'Utforsk', findCountry: 'Finn landet', nameCountry: 'Navngi landet',
    identifyQuestion: 'Hvilket land er markert?', yourGuess: 'Ditt forslag', countryNamePlaceholder: 'Skriv et landsnavn…',
    countrySuggestions: 'Forslag til land', noCountryMatches: 'Ingen treff blant landene',
    countryAnswerHint: 'Skriv for å søke · ↑ ↓ for å velge · Enter for å svare', notQuite: 'Ikke helt.', correctAnswer: 'Riktig svar:', highlightedCountry: 'Markert land', worldMapGame: 'Verdenskartspill',
    region: 'Region', projection: 'Projeksjon', regionalEqualArea: 'Regional arealriktig', mapSettings: 'Kartinnstillinger', mapControls: 'Kartvalg', highDetail: 'Høy detaljgrad', bathymetry: 'Havdybde', relief: 'Relieff', waterNames: 'Havnavn', limitAutomaticCountryZoom: 'Begrens landzoom', limitCountryZoomHint: 'Vis mer av omgivelsene når kartet automatisk zoomer inn på et land. Manuell zoom er uendret.',
    showScaleBar: 'Vis målestokk', scaleUnits: 'Måleenheter', metricUnits: 'Metrisk', imperialUnits: 'Britiske enheter', nauticalUnits: 'Nautiske mil', scaleAtMapCenter: 'Omtrentlig målestokk nær kartets sentrum: {distance}',
    autoRegionalProjection: 'Arealriktige regioner',
    autoRegionalProjectionHint: 'Når du velger en region, bytt til Regional arealriktig for å bevare landenes relative areal. Verdensvisningen bruker fortsatt den valgte globale projeksjonen.',
    mapPerformanceHint: 'Disse valgene kan gjøre kartet tregere på mobil eller mindre kraftige enheter.',
    interactiveMap: 'Interaktivt verdenskart', resetView: 'Tilbakestill visning',
    fastZoomPreview: 'Rask zoom-forhåndsvisning', touchPanPreview: 'Panoreringsvisning', normalZoom: 'Normal zoom', restoringZoomDetail: 'Gjenoppretter detaljer', svgZoom: 'SVG-visning',
    copyLastGesture: 'Kopier siste zoom- eller panoreringsrapport', noGestureReport: 'Zoom eller panorer kartet for å registrere en rapport', gestureCopied: 'Bevegelsesrapport kopiert', gestureCopyFailed: 'Kopiering feilet – trykk igjen',
    mapHint: 'Rull for å zoome · Dra for å flytte', continueHint: 'Klikk på kartet eller trykk mellomrom for å fortsette',
    loadingMap: 'Laster detaljert kart…', selectedCountry: 'Valgt land', selectedArea: 'Valgt område',
    mapCode: 'Kartkode · {code}', chooseCountry: 'Velg et land på kartet',
    flag: 'Flagget til {name}', quiz: 'Finn landet', regionComplete: 'Regionen er fullført',
    finalScore: 'Sluttresultat: {score} / {total}', playAgain: 'Spill igjen',
    restartQuiz: 'Start quizen på nytt',
    restartQuizConfirmation: 'Starte denne quizen på nytt? Fremgangen i denne runden går tapt.',
    leaveQuizConfirmation: 'Forlate quizen? Fremgangen i denne runden går tapt.',
    changeQuizRegionConfirmation: 'Starte en ny quiz i {region}? Fremgangen i den nåværende runden går tapt.',
    noCountries: 'Ingen quizland i denne regionen',
    questionStatus: 'Spørsmål {number}/{total} · {score} {points}', point: 'poeng', points: 'poeng',
    find: 'Finn {name}', clickLocation: 'Klikk på landet i kartet',
    countryMarkers: 'Landmarkører',
    countryMarkersHint: 'Vis prikker for små land i regionale eller innzoomede visninger, og stedsmarkører for små quizland.',
    chooseSmallCountry: 'Velg dette landet',
    zoomHere: 'Zoom inn for å se små land',
    correctSmallCountry: 'Riktig land: {name}', wrongSmallCountry: 'Ditt svar: {name}',
    wrongAnswerMarker: 'Landet du valgte',
    correct: 'Riktig! +1 poeng.', wrong: 'Ikke helt. Riktig land er markert i grønt.',
    youClickedBefore: 'Du klikket på ', youClickedAfter: '.', whatDidIClick: 'Hva klikket jeg på?',
    skipQuestion: 'Hopp over', skippedQuestion: 'Hoppet over. Ingen poeng.', showAnswer: 'Vis svaret', showAutomatically: 'Vis alltid',
    alwaysRevealAnswers: 'Vis alltid svar etter feil forslag eller når du hopper over',
    revealAnswersAutomatically: 'Vis svar automatisk', revealAnswersAutomaticallyHint: 'Vis riktig landsnavn etter et feil forslag eller når du hopper over et spørsmål.',
    myGuess: 'Mitt forslag', mapAppearance: 'Kartutseende', quizSettings: 'Quiz', navigationAndScale: 'Navigasjon og målestokk',
    answerSuggestions: 'Svarforslag', selectedRegion: 'Valgt region', allCountries: 'Alle land',
    appliesToMode: 'For {mode}', answerSuggestionsHint: 'Spørsmålene kommer alltid fra valgt region.',
    revealClickedCountry: 'Vis navn på landet du klikket', revealClickedCountryHint: 'Vis hvilket land du klikket etter et feil svar.',
    viewingOutsideGuess: 'Viser forslaget ditt utenfor valgt region.',
    showOnMap: 'Vis i kartet', showCountryOnMap: 'Vis {name} i kartet',
    seeResults: 'Se resultat', nextCountry: 'Neste land',
  },
} satisfies Record<Locale, Record<string, string>>

export type MessageKey = keyof typeof messages.en

export function t(key: MessageKey, values: Record<string, string | number> = {}) {
  return messages[locale.value][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

const norwegianRegions: Record<MapRegion['id'], string> = {
  world: 'Verden', europe: 'Europa', 'western-europe': 'Vest-Europa', 'eastern-europe': 'Øst-Europa',
  balkans: 'Balkan', africa: 'Afrika', asia: 'Asia',
  'middle-east-western-asia': 'Midtøsten og Vest-Asia', 'central-south-asia': 'Sentral- og Sør-Asia',
  'east-southeast-asia': 'Øst- og Sørøst-Asia', 'north-america': 'Nord-Amerika',
  'central-america-caribbean': 'Mellom-Amerika og Karibia',
  'south-america': 'Sør-Amerika', oceania: 'Oseania',
}

export function regionName(region: MapRegion) {
  return locale.value === 'nb' ? norwegianRegions[region.id] : region.label
}

// Every country identity has app-owned names, independent of browser locale
// databases, source-data labels, and flag codes. The build checks coverage.
const countryDisplayNames = displayNames as Record<string, Record<Locale, string>>

export function countryName(id: string) {
  if (!countryInfoById.has(id)) return id
  return countryDisplayNames[id]![locale.value]
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
