import type { LocationType } from '@/prisma/generated/enums'
import type { LocationGenerateLine } from '@/schema/location'
import { LOCATION_BAY_OPTIONS, LOCATION_LEVEL_OPTIONS, LOCATION_RACK_OPTIONS } from '@/constants/location'

export type LocationCodeParts = {
  siteCode: string
  processZoneCode: string
  bayCode: string
  levelCode?: string | null
  rackCode?: string | null
}

export type GeneratedLocation = LocationCodeParts & {
  code: string
  lineIndex: number
  type: LocationType | null
  isPalletAllowed: boolean
  isRepeated: boolean
}

//* SITE-ZONE-BAY, plus -LEVELRACK when both are set
export function buildLocationCode({ siteCode, processZoneCode, bayCode, levelCode, rackCode }: LocationCodeParts) {
  const base = [siteCode, processZoneCode, bayCode].join('-')
  const suffix = `${levelCode ?? ''}${rackCode ?? ''}`
  return suffix ? `${base}-${suffix}` : base
}

//* keep picks in option order, not click order
const sortByOptions = (values: string[], options: string[]) => options.filter((option) => values.includes(option))

//* every code a run makes, later repeats flagged
export function expandLocationRun(siteCode: string, lines: LocationGenerateLine[]): GeneratedLocation[] {
  const seen = new Set<string>()
  const rows: GeneratedLocation[] = []

  lines.forEach((line, lineIndex) => {
    const bays = sortByOptions(line.bayCodes, LOCATION_BAY_OPTIONS)
    //* an empty pick means no level or no rack
    const pickedLevels = sortByOptions(line.levelCodes, LOCATION_LEVEL_OPTIONS)
    const pickedRacks = sortByOptions(line.rackCodes, LOCATION_RACK_OPTIONS)
    const levels = pickedLevels.length > 0 ? pickedLevels : [null]
    const racks = pickedRacks.length > 0 ? pickedRacks : [null]

    for (const bayCode of bays) {
      for (const levelCode of levels) {
        for (const rackCode of racks) {
          const parts = { siteCode, processZoneCode: line.processZoneCode, bayCode, levelCode, rackCode }
          const code = buildLocationCode(parts)

          rows.push({ ...parts, code, lineIndex, type: line.type, isPalletAllowed: line.isPalletAllowed, isRepeated: seen.has(code) })
          seen.add(code)
        }
      }
    }
  })

  return rows
}
