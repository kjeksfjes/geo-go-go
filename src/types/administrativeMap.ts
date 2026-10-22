import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { Locale, MessageKey } from '../i18n'

export type AdministrativeMapId = 'norway-counties' | 'usa-states'
export type PlaceKind = 'country' | 'county' | 'state'
export interface AdministrativePlace { id: string; name: string }
export type AdministrativeFeature = Feature<Polygon | MultiPolygon> & { id: string }
export interface AdministrativeMapData {
  id: AdministrativeMapId
  kind: 'county' | 'state'
  layout: 'geographic' | 'us-insets'
  features: AdministrativeFeature[]
  places: ReadonlyMap<string, AdministrativePlace>
  ids: ReadonlySet<string>
  names: Readonly<Record<Locale, Readonly<Record<string, string>>>>
  badges: Readonly<Record<string, string>>
  aliases?: Readonly<Record<string, readonly string[]>>
  zoomReferenceIds: readonly string[]
  attribution: { label: MessageKey; url: string }
  badgeSourcesUrl?: string
}

export interface AdministrativeGameProps {
  mode: 'explore' | 'find-country' | 'name-country'
  settingsOpen: boolean
  automaticAnswerReveal: boolean
  alwaysShowWrongAnswer: boolean
  quizTipsEnabled: boolean
}
