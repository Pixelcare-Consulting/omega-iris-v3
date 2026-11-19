import type { ActivityConfig } from '@/types/activity-log'
import type { Pallet } from '@/prisma/generated/client'
import { STORAGE_UNIT_STATUS_LABELS } from '@/constants/storage-unit'

export const PALLET_ACTIVITY_CONFIG: ActivityConfig<Pallet> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'isGeneralPurpose', label: 'General Purpose' },
    { key: 'projectCategoryCode', label: 'Project Category' },
    { key: 'customerProjectCode', label: 'Customer Project' },
    { key: 'locationCode', label: 'Location' },
    { key: 'status', label: 'Status', format: (row) => STORAGE_UNIT_STATUS_LABELS[row.status] }
  ]
}
