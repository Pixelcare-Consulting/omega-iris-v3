import type { StorageUnitStatus } from '@/prisma/generated/enums'

//* shared by pallets and containers
export const STORAGE_UNIT_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'EMPTIED',
  'RETIRED',
  'CANCELLED',
  'DAMAGED'
] as const satisfies readonly StorageUnitStatus[]

export const STORAGE_UNIT_STATUS_LABELS: Record<StorageUnitStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  EMPTIED: 'Emptied',
  RETIRED: 'Retired',
  CANCELLED: 'Cancelled',
  DAMAGED: 'Damaged'
}

export const STORAGE_UNIT_STATUS_OPTIONS = STORAGE_UNIT_STATUSES.map((value) => ({ label: STORAGE_UNIT_STATUS_LABELS[value], value }))
