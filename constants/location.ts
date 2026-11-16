import type { LocationType } from '@/prisma/generated/enums'

//TODO: move to settings
export const LOCATION_MAX_BAY = 19
//TODO: move to settings
export const LOCATION_MAX_LEVEL = 5
//TODO: move to settings
export const LOCATION_MAX_RACK = 'R'

//* bulk generate creates at most this many per run
export const LOCATION_GENERATE_MAX_ROWS = 5000
export const LOCATION_GENERATE_MAX_LINES = 50

const toPaddedOptions = (max: number) => Array.from({ length: max }, (_, index) => String(index + 1).padStart(2, '0'))

export const LOCATION_BAY_OPTIONS = toPaddedOptions(LOCATION_MAX_BAY)
export const LOCATION_LEVEL_OPTIONS = toPaddedOptions(LOCATION_MAX_LEVEL)
export const LOCATION_RACK_OPTIONS = Array.from({ length: LOCATION_MAX_RACK.charCodeAt(0) - 64 }, (_, index) =>
  String.fromCharCode(65 + index)
)

export const LOCATION_TYPES = ['PALLET_RACK', 'BIN', 'PROCESS_ZONE'] as const satisfies readonly LocationType[]

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  PALLET_RACK: 'Pallet Rack',
  BIN: 'Bin',
  PROCESS_ZONE: 'Process Zone'
}

export const LOCATION_TYPE_OPTIONS = LOCATION_TYPES.map((value) => ({ label: LOCATION_TYPE_LABELS[value], value }))
