export interface CountrySuggestion {
  id: string
  name: string
}

export function normalizeCountrySearch(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/[’']/g, '').trim()
}

export function filterCountrySuggestions(options: readonly CountrySuggestion[], query: string, locale: string) {
  const search = normalizeCountrySearch(query)
  const collator = new Intl.Collator(locale, { sensitivity: 'base' })
  return options.filter(({ name }) => normalizeCountrySearch(name).includes(search))
    .sort((a, b) => {
      const prefix = Number(normalizeCountrySearch(b.name).startsWith(search))
        - Number(normalizeCountrySearch(a.name).startsWith(search))
      return prefix || collator.compare(a.name, b.name)
    })
}
