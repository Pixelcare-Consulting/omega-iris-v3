import type { ActivityConfig } from '@/types/activity-log'
import type { ProcessZone } from '@/prisma/generated/client'

export const PROCESS_ZONE_ACTIVITY_CONFIG: ActivityConfig<ProcessZone> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'isPalletEligible', label: 'Pallet Eligible' },
    { key: 'isActive', label: 'Active' }
  ]
}
