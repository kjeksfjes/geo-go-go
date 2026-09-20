import { countries, countryInfoById } from './countries'

// The atlas includes dependencies, overseas territories, and disputed map
// features alongside states. This is a practical quiz set, not a statement
// about diplomatic recognition: it includes Vatican City, Palestine, Kosovo,
// and Taiwan, while leaving non-state features visible as possible wrong picks.
const nonStateAtlasNames = new Set([
  'American Samoa',
  'Anguilla',
  'Aruba',
  'Ashmore and Cartier Is.',
  'Bermuda',
  'Br. Indian Ocean Ter.',
  'British Virgin Is.',
  'Cayman Is.',
  'Cook Is.',
  'Curaçao',
  'Faeroe Is.',
  'Falkland Is.',
  'Fr. Polynesia',
  'Fr. S. Antarctic Lands',
  'Greenland',
  'Guam',
  'Guernsey',
  'Heard I. and McDonald Is.',
  'Hong Kong',
  'Indian Ocean Ter.',
  'Isle of Man',
  'Jersey',
  'Macao',
  'Montserrat',
  'N. Cyprus',
  'N. Mariana Is.',
  'New Caledonia',
  'Niue',
  'Norfolk Island',
  'Pitcairn Is.',
  'Puerto Rico',
  'S. Geo. and the Is.',
  'Saint Helena',
  'Siachen Glacier',
  'Sint Maarten',
  'Somaliland',
  'St-Barthélemy',
  'St-Martin',
  'St. Pierre and Miquelon',
  'Turks and Caicos Is.',
  'U.S. Virgin Is.',
  'W. Sahara',
  'Wallis and Futuna Is.',
  'Åland',
])

export const quizCountryIds = new Set(
  countries
    .filter((country) => !nonStateAtlasNames.has(country.properties.name))
    .filter((country) => countryInfoById.get(country.id)?.flagCode !== 'un')
    .map((country) => country.id),
)
