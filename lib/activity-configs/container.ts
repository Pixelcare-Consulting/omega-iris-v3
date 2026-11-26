import type { ActivityConfig } from '@/types/activity-log'
import type { Container } from '@/prisma/generated/client'
import { STORAGE_UNIT_STATUS_LABELS } from '@/constants/storage-unit'
import { CONTAINER_TYPE_LABELS } from '@/constants/container'

export const CONTAINER_ACTIVITY_CONFIG: ActivityConfig<Container> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'type', label: 'Type', format: (row) => CONTAINER_TYPE_LABELS[row.type] },
    { key: 'isGeneralPurpose', label: 'General Purpose' },
    { key: 'projectCategoryCode', label: 'Project Category' },
    { key: 'customerProjectCode', label: 'Customer Project' },
    { key: 'locationCode', label: 'Location' },
    { key: 'palletCode', label: 'Pallet' },
    { key: 'status', label: 'Status', format: (row) => STORAGE_UNIT_STATUS_LABELS[row.status] }
  ]
}
