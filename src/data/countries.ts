import flagCountries from 'flag-icons/country.json'
import { geoArea } from 'd3-geo'
import baseMapUnits from './ne-map-units-50m.json'
import baseRegionalGeometry from './regional-display-50m.json'
import baseCombinedGeometry from './combined-geographic-units-50m.json'
import baseMeaningfulSubunits from './meaningful-subunits-50m.json'
import semanticMapUnits from './meaningful-map-units.json'
import quizIdentityByMapUnitId from './ne-quiz-identity-by-map-unit.json'
import type { Geometry } from 'geojson'
import type {
  CountryInfo,
  GeographicComponentInfo,
  GeographicUnitFeature,
  MapUnitFeature,
  MapSubunitFeature,
  RegionalDisplayGeometry,
  SovereignInfo,
} from '../types/country'

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

// GU_A3 identifies a Natural Earth source part. ADM0_A3 identifies the quiz
// answer to which one or more parts belong. SOV_A3 independently records
// Natural Earth's sovereign relationship.
type RegionalGeometry = NonNullable<MapUnitFeature['regionalDisplayGeometry']>
type RegionalGeometryIndex = Record<string, Record<string, RegionalDisplayGeometry>>

function regionalGeometryForUnit(index: RegionalGeometryIndex, unitId: string): RegionalGeometry | undefined {
  const entries = Object.entries(index)
    .flatMap(([regionId, units]) => units[unitId] ? [[regionId, units[unitId]] as const] : [])
  return entries.length ? Object.fromEntries(entries) : undefined
}

const baseRegionalIndex = baseRegionalGeometry as RegionalGeometryIndex
export const mapUnits: MapUnitFeature[] = (baseMapUnits.features as unknown as MapUnitFeature[]).map((unit) => ({
  ...unit,
  quizEntityId: (quizIdentityByMapUnitId as Record<string, string>)[unit.id] ?? unit.properties.entityId,
  regionalDisplayGeometry: regionalGeometryForUnit(baseRegionalIndex, unit.id),
}))
export const mapUnitById = new Map(mapUnits.map((unit) => [unit.id, unit]))
for (const [unitId, entityId] of Object.entries(quizIdentityByMapUnitId)) {
  if (!mapUnitById.has(unitId) || !mapUnits.some((unit) => unit.properties.entityId === entityId)) {
    throw new Error(`Invalid canonical quiz identity for map unit ${unitId}: ${entityId}`)
  }
}

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
  const siblings = unitsByEntityId.get(unit.quizEntityId) ?? []
  siblings.push(unit)
  unitsByEntityId.set(unit.quizEntityId, siblings)
}

export const countryInfoById = new Map<string, CountryInfo>()
for (const [id, units] of unitsByEntityId) {
  const primary = units.find((unit) => unit.id === id)
    ?? units.find(({ properties }) => properties.name === properties.adminName)
    ?? units[0]
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

const independentlyMeaningfulUnitIds = new Set<string>(
  Object.values(semanticMapUnits.independentMapUnitIdsByEntity).flat(),
)
const subunitIdsByMapUnit: Record<string, string[]> = semanticMapUnits.independentMapSubunitIdsByMapUnit
const mapSubunits = baseMeaningfulSubunits.features as unknown as MapSubunitFeature[]

type ComponentMetadataOverride = {
  name?: Partial<Record<'en' | 'nb', string>>
  type?: Partial<Record<'en' | 'nb', string>>
  flagCode?: string
}
const metadataOverrides = semanticMapUnits.metadataOverrides as Record<string, ComponentMetadataOverride>
export const componentInfoById = new Map<string, GeographicComponentInfo>()

function componentFlagCode(sourceCode: string | undefined, entityId: string): string | undefined {
  if (!sourceCode) return undefined
  const code = sourceCode.toLowerCase()
  if (!validFlagCodes.has(code)) throw new Error(`Unknown component flag: ${sourceCode}`)
  return code !== countryInfoById.get(entityId)?.flagCode ? code : undefined
}

for (const id of independentlyMeaningfulUnitIds) {
  const unit = mapUnitById.get(id)
  if (!unit) throw new Error(`Meaningful map unit not found: ${id}`)
  const componentId = `map-unit:${id}`
  const override = metadataOverrides[componentId]
  componentInfoById.set(componentId, {
    id: componentId,
    sourceKind: 'map-unit',
    sourceId: id,
    entityId: unit.quizEntityId,
    name: unit.properties.name,
    sourceType: unit.properties.featureType,
    // An ISO territory code does not imply a distinct flag in flag-icons;
    // several entries simply repeat the sovereign flag. Curate only real
    // secondary flags in the semantic component metadata.
    flagCode: componentFlagCode(override?.flagCode, unit.quizEntityId),
    nameOverrides: override?.name,
    typeOverrides: override?.type,
  })
}

for (const unit of mapSubunits) {
  if (unit.id.startsWith('remainder:')) continue
  const parent = mapUnitById.get(unit.properties.mapUnitId)
  if (!parent) throw new Error(`Map subunit has no parent: ${unit.id}`)
  const componentId = `map-subunit:${unit.id}`
  const override = metadataOverrides[componentId]
  componentInfoById.set(componentId, {
    id: componentId,
    sourceKind: 'map-subunit',
    sourceId: unit.id,
    entityId: parent.quizEntityId,
    name: unit.properties.name,
    sourceType: unit.properties.featureType,
    flagCode: componentFlagCode(override?.flagCode, parent.quizEntityId),
    nameOverrides: override?.name,
    typeOverrides: override?.type,
  })
}
for (const id of Object.keys(metadataOverrides)) {
  if (!componentInfoById.has(id)) throw new Error(`Unknown component metadata override: ${id}`)
}

type CombinedGeometryIndex = Record<string, Geometry>
const baseCombinedIndex = baseCombinedGeometry as CombinedGeometryIndex

function buildGeographicUnits(
  units: MapUnitFeature[],
  combinedGeometry: CombinedGeometryIndex,
  subunits: MapSubunitFeature[],
  fallbackGeometry = baseCombinedIndex,
): GeographicUnitFeature[] {
  const partsByGeographicId = new Map<string, MapUnitFeature[]>()
  const selectedSubunitById = new Map(subunits.map((unit) => [unit.id, unit]))
  const geographicUnits: GeographicUnitFeature[] = []
  for (const unit of units) {
    const selectedSubunitIds = subunitIdsByMapUnit[unit.id]
    if (selectedSubunitIds) {
      for (const subunitId of selectedSubunitIds) {
        const subunit = selectedSubunitById.get(subunitId)
        if (
          !subunit
          || subunit.properties.mapUnitId !== unit.id
          || subunit.properties.entityId !== unit.properties.entityId
        ) {
          throw new Error(`Missing map subunit ${subunitId} for ${unit.id}`)
        }
        geographicUnits.push({
          type: 'Feature',
          id: `subunit:${subunitId}`,
          properties: {
            entityId: unit.quizEntityId,
            mapUnitIds: [unit.id],
            componentId: `map-subunit:${subunitId}`,
          },
          geometry: subunit.geometry,
        })
      }
      const remainder = selectedSubunitById.get(`remainder:${unit.id}`)
      if (remainder) {
        if (
          remainder.properties.mapUnitId !== unit.id
          || remainder.properties.entityId !== unit.properties.entityId
        ) {
          throw new Error(`Invalid map subunit remainder for ${unit.id}`)
        }
        geographicUnits.push({
          type: 'Feature',
          id: remainder.id,
          properties: {
            entityId: unit.quizEntityId,
            mapUnitIds: [unit.id],
          },
          geometry: remainder.geometry,
          ...(remainder.regionalDisplayGeometry
            ? { regionalDisplayGeometry: remainder.regionalDisplayGeometry }
            : {}),
        })
      } else if (unit.regionalDisplayGeometry) {
        throw new Error(`Missing regional map subunit remainder for ${unit.id}`)
      }
      continue
    }

    const geographicId = independentlyMeaningfulUnitIds.has(unit.id)
      ? `unit:${unit.id}`
      : `entity:${unit.quizEntityId}`
    const parts = partsByGeographicId.get(geographicId) ?? []
    parts.push(unit)
    partsByGeographicId.set(geographicId, parts)
  }

  for (const [id, parts] of partsByGeographicId) {
    const entityId = parts[0].quizEntityId
    const geometry = parts.length === 1
      ? parts[0].geometry
      : (parts.some((part) => mapUnitById.get(part.id) === part)
          ? fallbackGeometry[entityId]
          : combinedGeometry[entityId])
    if (!geometry) throw new Error(`Missing combined geometry for ${entityId}`)
    geographicUnits.push({
      type: 'Feature',
      id,
      properties: {
        entityId,
        mapUnitIds: parts.map((part) => part.id),
        ...(id.startsWith('unit:') ? { componentId: `map-unit:${parts[0].id}` } : {}),
      },
      geometry,
      ...(parts.length === 1 && parts[0].regionalDisplayGeometry
        ? { regionalDisplayGeometry: parts[0].regionalDisplayGeometry }
        : {}),
    })
  }

  return geographicUnits
}

export const geographicUnits = buildGeographicUnits(mapUnits, baseCombinedIndex, mapSubunits)
export const geographicUnitById = new Map(geographicUnits.map((unit) => [unit.id, unit]))

let detailedGeographicUnitsPromise: Promise<GeographicUnitFeature[]> | undefined

export function loadDetailedGeographicUnits() {
  detailedGeographicUnitsPromise ??= Promise.all([
    import('./ne-map-units-10m.json'),
    import('./regional-display-10m.json'),
    import('./combined-geographic-units-10m.json'),
    import('./meaningful-subunits-10m.json'),
  ])
    .then(([
      { default: detailed },
      { default: detailedRegionalGeometry },
      { default: detailedCombinedGeometry },
      { default: detailedSubunits },
    ]) => {
      const detailedById = new Map(detailed.features.map((feature) => [feature.id, feature]))
      const units = mapUnits.map((base) => {
        const feature = detailedById.get(base.id)
        if (!feature) return base
        const unit: MapUnitFeature = {
          ...base,
          geometry: feature.geometry as MapUnitFeature['geometry'],
          regionalDisplayGeometry: regionalGeometryForUnit(
            detailedRegionalGeometry as RegionalGeometryIndex,
            base.id,
          ) ?? base.regionalDisplayGeometry,
        }
        // The detailed atlas can contain malformed oppositely wound rings.
        // Retain the corresponding 50m unit rather than rendering the globe.
        const area = geoArea(unit)
        return Number.isFinite(area) && area <= Math.PI * 2 ? unit : base
      })
      const detailedSubunitById = new Map(detailedSubunits.features.map((unit) => [unit.id, unit]))
      const subunits = mapSubunits.map((base) => {
        const feature = detailedSubunitById.get(base.id)
        if (!feature) return base
        const unit: MapSubunitFeature = {
          ...base,
          geometry: feature.geometry as MapSubunitFeature['geometry'],
          regionalDisplayGeometry: (feature.regionalDisplayGeometry as MapSubunitFeature['regionalDisplayGeometry'])
            ?? base.regionalDisplayGeometry,
        }
        const area = geoArea(unit)
        return Number.isFinite(area) && area <= Math.PI * 2 ? unit : base
      })
      return buildGeographicUnits(
        units,
        detailedCombinedGeometry as CombinedGeometryIndex,
        subunits,
      )
    })
    .catch((error: unknown) => {
      detailedGeographicUnitsPromise = undefined
      throw error
    })

  return detailedGeographicUnitsPromise
}
