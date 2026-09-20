import flagCountries from 'flag-icons/country.json'
import { geoArea } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-50m.json'
import type { CountryFeature, CountryInfo, CountryProperties } from '../types/country'

interface FlagCountry {
  code: string
  iso: boolean
  name: string
}

interface CountryOverride {
  flagCode: string
  name?: string
}

const countryOverrides: Record<string, CountryOverride> = {
  Vatican: { flagCode: 'va', name: 'Vatican City' },
  Micronesia: { flagCode: 'fm', name: 'Federated States of Micronesia' },
  'Marshall Is.': { flagCode: 'mh', name: 'Marshall Islands' },
  'N. Mariana Is.': { flagCode: 'mp', name: 'Northern Mariana Islands' },
  'U.S. Virgin Is.': { flagCode: 'vi', name: 'U.S. Virgin Islands' },
  'S. Geo. and the Is.': { flagCode: 'gs', name: 'South Georgia and the South Sandwich Islands' },
  'Br. Indian Ocean Ter.': { flagCode: 'io', name: 'British Indian Ocean Territory' },
  'Pitcairn Is.': { flagCode: 'pn', name: 'Pitcairn Islands' },
  'W. Sahara': { flagCode: 'eh', name: 'Western Sahara' },
  'Dem. Rep. Congo': { flagCode: 'cd', name: 'Democratic Republic of the Congo' },
  'Dominican Rep.': { flagCode: 'do', name: 'Dominican Republic' },
  'Falkland Is.': { flagCode: 'fk', name: 'Falkland Islands' },
  'Cayman Is.': { flagCode: 'ky', name: 'Cayman Islands' },
  'British Virgin Is.': { flagCode: 'vg', name: 'British Virgin Islands' },
  'Turks and Caicos Is.': { flagCode: 'tc', name: 'Turks and Caicos Islands' },
  'Fr. S. Antarctic Lands': { flagCode: 'tf', name: 'French Southern Territories' },
  'Central African Rep.': { flagCode: 'cf', name: 'Central African Republic' },
  Congo: { flagCode: 'cg', name: 'Republic of the Congo' },
  'Eq. Guinea': { flagCode: 'gq', name: 'Equatorial Guinea' },
  Palestine: { flagCode: 'ps', name: 'Palestine' },
  Turkey: { flagCode: 'tr', name: 'Türkiye' },
  'Solomon Is.': { flagCode: 'sb', name: 'Solomon Islands' },
  'São Tomé and Principe': { flagCode: 'st', name: 'São Tomé and Príncipe' },
  'St. Vin. and Gren.': { flagCode: 'vc', name: 'Saint Vincent and the Grenadines' },
  'St. Kitts and Nevis': { flagCode: 'kn', name: 'Saint Kitts and Nevis' },
  'Cook Is.': { flagCode: 'ck', name: 'Cook Islands' },
  Brunei: { flagCode: 'bn', name: 'Brunei' },
  Czechia: { flagCode: 'cz', name: 'Czechia' },
  'N. Cyprus': { flagCode: 'cy', name: 'Northern Cyprus' },
  Somaliland: { flagCode: 'so', name: 'Somaliland' },
  'Bosnia and Herz.': { flagCode: 'ba', name: 'Bosnia and Herzegovina' },
  Macedonia: { flagCode: 'mk', name: 'North Macedonia' },
  Kosovo: { flagCode: 'xk' },
  'S. Sudan': { flagCode: 'ss', name: 'South Sudan' },
  'St. Pierre and Miquelon': { flagCode: 'pm', name: 'Saint Pierre and Miquelon' },
  'Wallis and Futuna Is.': { flagCode: 'wf', name: 'Wallis and Futuna' },
  'St-Martin': { flagCode: 'mf', name: 'Saint Martin' },
  'St-Barthélemy': { flagCode: 'bl', name: 'Saint Barthélemy' },
  'Fr. Polynesia': { flagCode: 'pf', name: 'French Polynesia' },
  Åland: { flagCode: 'ax', name: 'Åland Islands' },
  'Faeroe Is.': { flagCode: 'fo', name: 'Faroe Islands' },
  Macao: { flagCode: 'mo', name: 'Macao' },
  'Indian Ocean Ter.': { flagCode: 'au', name: 'Australian Indian Ocean Territories' },
  'Heard I. and McDonald Is.': { flagCode: 'hm', name: 'Heard Island and McDonald Islands' },
  'Ashmore and Cartier Is.': { flagCode: 'au', name: 'Ashmore and Cartier Islands' },
  'Antigua and Barb.': { flagCode: 'ag', name: 'Antigua and Barbuda' },
  'Siachen Glacier': { flagCode: 'un' },
}

function fallbackCountryId(name: string) {
  return `region-${name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`
}

const countryIdOverrides: Record<string, string> = {
  // Natural Earth assigns Australia's ISO code to this separate territory path.
  'Ashmore and Cartier Is.': 'territory-ashmore-and-cartier-islands',
}

const flagCodeByName = new Map(
  (flagCountries as FlagCountry[]).map(({ code, name }) => [name, code]),
)

type CountriesTopology = Topology<{
  countries: GeometryCollection<CountryProperties>
}>

function countriesFromTopology(source: unknown): CountryFeature[] {
  const topology = source as CountriesTopology
  const collection = feature(
    topology,
    topology.objects.countries,
  ) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, CountryProperties>

  return collection.features
    // Mercator cannot display the poles; Antarctica is not a selectable country.
    .filter((country) => country.properties.name !== 'Antarctica')
    .map((country) => ({
      ...country,
      id: countryIdOverrides[country.properties.name]
        ?? (country.id === undefined
          ? fallbackCountryId(country.properties.name)
          : String(country.id)),
    }))
}

export const countries = countriesFromTopology(world)
const baseCountryIds = new Set(countries.map(({ id }) => id))
const baseCountryById = new Map(countries.map((country) => [country.id, country]))
let detailedCountriesPromise: Promise<CountryFeature[]> | undefined

export function loadDetailedCountries() {
  detailedCountriesPromise ??= import('world-atlas/countries-10m.json')
    .then(({ default: detailedWorld }) => countriesFromTopology(detailedWorld)
      .filter(({ id }) => baseCountryIds.has(id))
      .map((country) => {
        // The 10m atlas currently contains a few malformed, oppositely wound
        // micro-polygons in the Maldives. D3 interprets each as the rest of
        // the globe. Fall back per country if detailed data claims an area
        // larger than a hemisphere, which no country can legitimately cover.
        const area = geoArea(country)
        if (!Number.isFinite(area) || area > Math.PI * 2) {
          return baseCountryById.get(country.id) ?? country
        }

        return country
      }))
    .catch((error: unknown) => {
      detailedCountriesPromise = undefined
      throw error
    })

  return detailedCountriesPromise
}

export const countryInfoById = new Map<string, CountryInfo>(
  countries.map((country) => {
    const atlasName = country.properties.name
    const override = countryOverrides[atlasName]

    return [
      country.id,
      {
        id: country.id,
        name: override?.name ?? atlasName,
        flagCode: override?.flagCode ?? flagCodeByName.get(atlasName) ?? 'un',
      },
    ]
  }),
)
