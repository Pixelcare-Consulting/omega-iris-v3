import type { ActivityConfig } from '@/types/activity-log'
import type { Site } from '@/prisma/generated/client'

export const SITE_ACTIVITY_CONFIG: ActivityConfig<Site> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'isEnableInbound', label: 'Inbound' },
    { key: 'isEnableOutbound', label: 'Outbound' },
    { key: 'isEnableMovement', label: 'Movement' },
    { key: 'isEnableCycleCount', label: 'Cycle Count' },
    { key: 'isEnableQcTesting', label: 'QC/Testing' },
    { key: 'isEnableRma', label: 'RMA' },
    { key: 'isActive', label: 'Active' }
  ]
}
