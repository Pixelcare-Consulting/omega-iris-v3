import type { ActivityConfig } from '@/types/activity-log'
import type { Location } from '@/prisma/generated/client'
import { LOCATION_TYPE_LABELS } from '@/constants/location'

export const LOCATION_ACTIVITY_CONFIG: ActivityConfig<Location> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', format: (row) => (row.type ? LOCATION_TYPE_LABELS[row.type] : null) },
    { key: 'siteCode', label: 'Site' },
    { key: 'processZoneCode', label: 'Process Zone' },
    { key: 'bayCode', label: 'Bay' },
    { key: 'levelCode', label: 'Level' },
    { key: 'rackCode', label: 'Rack' },
    { key: 'isActive', label: 'Active' },
    { key: 'isPalletAllowed', label: 'Pallet Allowed' }
  ]
}
