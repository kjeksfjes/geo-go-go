import { countries } from './countries'
import type { MapPoint } from '../composables/useMapZoom'

export type MapRegionId =
  | 'world' | 'europe' | 'nordics' | 'baltics' | 'balkans'
  | 'africa' | 'asia' | 'east-asia' | 'southeast-asia' | 'south-asia' | 'central-asia'
  | 'middle-east' | 'north-america' | 'central-america' | 'caribbean'
  | 'south-america' | 'oceania'

export interface MapRegion {
  id: MapRegionId
  label: string
  // A parent includes its children's countries plus any listed here.
  countryNames?: readonly string[]
  view: { center: MapPoint; zoom: number } | null
  children?: readonly MapRegion[]
}

export const regions: readonly MapRegion[] = [
  { id: 'world', label: 'World', view: null },
  {
    id: 'europe', label: 'Europe', view: { center: [15, 52], zoom: 3.1 },
    countryNames: [
      'Andorra', 'Austria', 'Belarus', 'Belgium', 'Cyprus', 'Czechia',
      'France', 'Germany', 'Guernsey', 'Hungary', 'Ireland', 'Isle of Man',
      'Italy', 'Jersey', 'Liechtenstein', 'Luxembourg', 'Malta', 'Moldova',
      'Monaco', 'N. Cyprus', 'Netherlands', 'Poland', 'Portugal', 'Russia',
      'San Marino', 'Slovakia', 'Spain', 'Switzerland', 'Ukraine',
      'United Kingdom', 'Vatican',
    ],
    children: [
      {
        id: 'nordics', label: 'Nordics', view: { center: [8, 64], zoom: 4.25 },
        countryNames: ['Denmark', 'Faeroe Is.', 'Finland', 'Greenland', 'Iceland', 'Norway', 'Sweden', 'Åland'],
      },
      {
        id: 'baltics', label: 'Baltics', view: { center: [25, 57.5], zoom: 7 },
        countryNames: ['Estonia', 'Latvia', 'Lithuania'],
      },
      {
        id: 'balkans', label: 'Balkans', view: { center: [22, 43], zoom: 5.7 },
        countryNames: [
          'Albania', 'Bosnia and Herz.', 'Bulgaria', 'Croatia', 'Greece',
          'Kosovo', 'Macedonia', 'Montenegro', 'Romania', 'Serbia',
          'Slovenia', 'Turkey',
        ],
      },
    ],
  },
  {
    id: 'africa', label: 'Africa', view: { center: [20, 2], zoom: 2.35 },
    countryNames: [
      'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
      'Cabo Verde', 'Cameroon', 'Central African Rep.', 'Chad', 'Comoros',
      'Congo', "Côte d'Ivoire", 'Dem. Rep. Congo', 'Djibouti', 'Egypt',
      'Eq. Guinea', 'Eritrea', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana',
      'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya',
      'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco',
      'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'S. Sudan',
      'Saint Helena', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia',
      'Somaliland', 'South Africa', 'Sudan', 'São Tomé and Principe',
      'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'W. Sahara', 'Zambia',
      'Zimbabwe', 'eSwatini',
    ],
  },
  {
    id: 'asia', label: 'Asia', view: { center: [88, 34], zoom: 1.85 },
    countryNames: ['Br. Indian Ocean Ter.', 'Cyprus', 'Indian Ocean Ter.', 'N. Cyprus', 'Russia', 'Siachen Glacier', 'Turkey'],
    children: [
      {
        id: 'middle-east', label: 'Middle East', view: { center: [44, 28], zoom: 4.25 },
        countryNames: [
          'Armenia', 'Azerbaijan', 'Bahrain', 'Cyprus', 'Egypt', 'Georgia',
          'Iran', 'Iraq', 'Israel', 'Jordan', 'Kuwait', 'Lebanon', 'N. Cyprus',
          'Oman', 'Palestine', 'Qatar', 'Saudi Arabia', 'Syria', 'Turkey',
          'United Arab Emirates', 'Yemen',
        ],
      },
      {
        id: 'central-asia', label: 'Central Asia', view: { center: [69, 42], zoom: 4 },
        countryNames: ['Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan'],
      },
      {
        id: 'south-asia', label: 'South Asia', view: { center: [78, 22], zoom: 3.8 },
        countryNames: [
          'Afghanistan', 'Bangladesh', 'Bhutan', 'India', 'Maldives', 'Nepal',
          'Pakistan', 'Sri Lanka',
        ],
      },
      {
        id: 'east-asia', label: 'East Asia', view: { center: [115, 37], zoom: 3 },
        countryNames: [
          'China', 'Hong Kong', 'Japan', 'Macao', 'Mongolia', 'North Korea',
          'South Korea', 'Taiwan',
        ],
      },
      {
        id: 'southeast-asia', label: 'Southeast Asia', view: { center: [108, 8], zoom: 4 },
        countryNames: [
          'Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar',
          'Philippines', 'Singapore', 'Thailand', 'Timor-Leste', 'Vietnam',
        ],
      },
    ],
  },
  {
    id: 'north-america', label: 'North America', view: { center: [-100, 38], zoom: 1.95 },
    countryNames: ['Bermuda', 'Canada', 'Greenland', 'Mexico', 'St. Pierre and Miquelon', 'United States of America'],
    children: [
      {
        id: 'central-america', label: 'Central America', view: { center: [-88, 15], zoom: 5.2 },
        countryNames: ['Belize', 'Costa Rica', 'El Salvador', 'Guatemala', 'Honduras', 'Mexico', 'Nicaragua', 'Panama'],
      },
      {
        id: 'caribbean', label: 'Caribbean', view: { center: [-70, 18], zoom: 5 },
        countryNames: [
          'Anguilla', 'Antigua and Barb.', 'Aruba', 'Bahamas', 'Barbados',
          'British Virgin Is.', 'Cayman Is.', 'Cuba', 'Curaçao', 'Dominica',
          'Dominican Rep.', 'Grenada', 'Haiti', 'Jamaica', 'Montserrat',
          'Puerto Rico', 'Saint Lucia', 'Sint Maarten', 'St-Barthélemy',
          'St-Martin', 'St. Kitts and Nevis', 'St. Vin. and Gren.',
          'Trinidad and Tobago', 'Turks and Caicos Is.', 'U.S. Virgin Is.',
        ],
      },
    ],
  },
  {
    id: 'south-america', label: 'South America', view: { center: [-61, -18], zoom: 2.45 },
    countryNames: [
      'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador',
      'Falkland Is.', 'Guyana', 'Paraguay', 'Peru', 'S. Geo. and the Is.',
      'Suriname', 'Uruguay', 'Venezuela',
    ],
  },
  {
    id: 'oceania', label: 'Oceania', view: { center: [150, -19], zoom: 2.15 },
    countryNames: [
      'American Samoa', 'Ashmore and Cartier Is.', 'Australia', 'Cook Is.',
      'Fiji', 'Fr. Polynesia', 'Guam', 'Heard I. and McDonald Is.',
      'Indian Ocean Ter.', 'Kiribati', 'Marshall Is.', 'Micronesia',
      'N. Mariana Is.', 'Nauru', 'New Caledonia', 'New Zealand', 'Niue',
      'Norfolk Island', 'Palau', 'Papua New Guinea', 'Pitcairn Is.', 'Samoa',
      'Solomon Is.', 'Tonga', 'Vanuatu', 'Wallis and Futuna Is.',
    ],
  },
]

export const regionById = new Map<MapRegionId, MapRegion>()
export const countryIdsByRegion = new Map<MapRegionId, ReadonlySet<string>>()
const countryIdByName = new Map(countries.map((country) => [country.properties.name, country.id]))

function indexRegion(region: MapRegion): Set<string> {
  regionById.set(region.id, region)

  if (region.id === 'world') {
    const allIds = new Set(countries.map(({ id }) => id))
    countryIdsByRegion.set(region.id, allIds)
    return allIds
  }

  const ids = new Set<string>()
  for (const name of region.countryNames ?? []) {
    const id = countryIdByName.get(name)
    if (id) ids.add(id)
  }
  for (const child of region.children ?? []) {
    for (const id of indexRegion(child)) ids.add(id)
  }

  countryIdsByRegion.set(region.id, ids)
  return ids
}

for (const region of regions) indexRegion(region)
