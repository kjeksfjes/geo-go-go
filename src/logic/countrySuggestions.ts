export interface CountrySuggestion {
  id: string
  name: string
}

export function normalizeCountrySearch(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/[’']/g, '').trim()
}

// Search aliases do not change the displayed name or create new quiz identities.
const countrySearchAliases: Readonly<Record<string, readonly string[]>> = {
  TUR: ['Türkiye'],
}

export function filterCountrySuggestions(options: readonly CountrySuggestion[], query: string, locale: string) {
  const search = normalizeCountrySearch(query)
  const collator = new Intl.Collator(locale, { sensitivity: 'base' })
  return options.map((option) => ({
    option,
    names: [option.name, ...(countrySearchAliases[option.id] ?? [])].map(normalizeCountrySearch),
  }))
    .filter(({ names }) => names.some((name) => name.includes(search)))
    .sort((a, b) => {
      const prefix = Number(b.names.some((name) => name.startsWith(search)))
        - Number(a.names.some((name) => name.startsWith(search)))
      return prefix || collator.compare(a.option.name, b.option.name)
    })
    .map(({ option }) => option)
}
