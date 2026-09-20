import flagCountries from 'flag-icons/country.json'
import { geoArea } from 'd3-geo'
import baseMapUnits from './ne-map-units-50m.json'
import baseRegionalGeometry from './regional-display-50m.json'
import type { CountryInfo, MapUnitFeature, RegionalDisplayGeometry, SovereignInfo } from '../types/country'

interface FlagCountry {
  code: string
  name: string
}

// Display/flag labels are presentation details. Geographic classification and
// sovereignty come from the Natural Earth map-unit records, not these aliases.
const entityOverrides: Record<string, { name?: string; flagCode?: string }> = {
  VAT: { name: 'Vatican City' },
  CZE: { name: 'Czechia' },
  TUR: { name: 'Türkiye' },
  PSX: { flagCode: 'ps' },
}

const flags = flagCountries as FlagCountry[]
const flagCodeByName = new Map(flags.map(({ name, code }) => [name, code]))
const validFlagCodes = new Set(flags.map(({ code }) => code))

// GU_A3 identifies a rendered map unit. ADM0_A3 identifies the administrative
// country/quiz answer to which one or more units belong. SOV_A3 independently
// records Natural Earth's sovereign relationship.
type RegionalGeometry = NonNullable<MapUnitFeature['regionalDisplayGeometry']>
type RegionalGeometryIndex = Record<string, Record<string, RegionalDisplayGeometry>>

function regionalGeometryForUnit(index: RegionalGeometryIndex, unitId: string): RegionalGeometry | undefined {
  const entries = Object.entries(index)
    .flatMap(([regionId, units]) => units[unitId] ? [[regionId, units[unitId]] as const] : [])
  return entries.length ? Object.fromEntries(entries) : undefined
}

const baseRegionalIndex = baseRegionalGeometry as RegionalGeometryIndex
export const mapUnits = (baseMapUnits.features as unknown as MapUnitFeature[]).map((unit) => ({
  ...unit,
  regionalDisplayGeometry: regionalGeometryForUnit(baseRegionalIndex, unit.id),
}))
export const mapUnitById = new Map(mapUnits.map((unit) => [unit.id, unit]))

const unitsBySovereignId = new Map<string, MapUnitFeature[]>()
for (const unit of mapUnits) {
  const siblings = unitsBySovereignId.get(unit.properties.sovereignId) ?? []
  siblings.push(unit)
  unitsBySovereignId.set(unit.properties.sovereignId, siblings)
}
export const sovereignInfoById = new Map<string, SovereignInfo>(
  [...unitsBySovereignId].map(([id, units]) => [id, {
    id,
    name: units[0].properties.sovereignName,
    entityIds: [...new Set(units.map((unit) => unit.properties.entityId))],
    mapUnitIds: units.map((unit) => unit.id),
  }]),
)

const unitsByEntityId = new Map<string, MapUnitFeature[]>()
for (const unit of mapUnits) {
  const siblings = unitsByEntityId.get(unit.properties.entityId) ?? []
  siblings.push(unit)
  unitsByEntityId.set(unit.properties.entityId, siblings)
}

export const countryInfoById = new Map<string, CountryInfo>()
for (const [id, units] of unitsByEntityId) {
  const primary = units.find(({ properties }) => properties.name === properties.adminName) ?? units[0]
  const { adminName, sovereignId, sovereignName } = primary.properties
  const override = entityOverrides[id]
  const isoCode = primary.properties.isoA2.toLowerCase()
  const flagCode = override?.flagCode
    ?? flagCodeByName.get(adminName)
    ?? (validFlagCodes.has(isoCode) ? isoCode : 'un')
  const isDependent = adminName !== sovereignName
    && units.some(({ properties }) =>
      !['Geo unit', 'Indeterminate'].includes(properties.featureType),
    )

  countryInfoById.set(id, {
    id,
    name: override?.name ?? adminName,
    flagCode,
    sovereignId,
    ...(isDependent ? { parentSovereignId: sovereignId } : {}),
    mapUnitIds: units.map((unit) => unit.id),
  })
}

let detailedMapUnitsPromise: Promise<MapUnitFeature[]> | undefined

export function loadDetailedMapUnits() {
  detailedMapUnitsPromise ??= Promise.all([
    import('./ne-map-units-10m.json'),
    import('./regional-display-10m.json'),
  ])
    .then(([{ default: detailed }, { default: detailedRegionalGeometry }]) => detailed.features.map((feature) => {
      const base = mapUnitById.get(feature.id)
      if (!base) return null
      const unit: MapUnitFeature = {
        ...base,
        geometry: feature.geometry as MapUnitFeature['geometry'],
        regionalDisplayGeometry: regionalGeometryForUnit(
          detailedRegionalGeometry as RegionalGeometryIndex,
          feature.id,
        ) ?? base.regionalDisplayGeometry,
      }
      // The detailed atlas can contain malformed oppositely wound rings.
      // Retain the corresponding 50m unit rather than rendering the globe.
      const area = geoArea(unit)
      return Number.isFinite(area) && area <= Math.PI * 2 ? unit : base
    }).filter((unit): unit is MapUnitFeature => unit !== null))
    .catch((error: unknown) => {
      detailedMapUnitsPromise = undefined
      throw error
    })

  return detailedMapUnitsPromise
}
